/**
 * INTEGRATION CONTRACT: internal (A2 training)
 * Purpose: the pure state machine behind session mode. It knows nothing about React, SQLite or the
 *          clock: callers pass `nowMs` in, so pausing, backgrounding and time jumps cannot drift.
 *          It NEVER modifies an exercise (GAT-005).
 * Canonical definition: AGENT_02_PROMPT.md §4
 * Consumers: SessionRunScreen.tsx, useSessionRunner.ts, sessionMachine.test.ts
 * Contract status: APPROVED (internal symbol, no registry ID)
 */
import type {
  Exercise,
  ExerciseIntensity,
  SaveSessionInput,
  SessionExerciseStatus,
} from '@/shared/types/training';

export type SessionPhase = 'ready' | 'work' | 'rest' | 'paused' | 'finished' | 'stopped';

export interface ExerciseProgress {
  status: SessionExerciseStatus;
  completedSets: number;
  completedReps: number | null;
  /** Milliseconds actually spent working on this exercise, excluding rest and pauses. */
  activeMs: number;
}

export interface SessionMachineState {
  phase: SessionPhase;
  /** Phase to return to when a pause is lifted. */
  resumePhase: Exclude<SessionPhase, 'paused'>;
  exerciseIndex: number;
  setIndex: number;
  repsPerSet: number[];
  secondsRemaining: number | null;
  /** Active-time accumulator; only advanced by `tick` and `setDone`, never by pause. */
  activeMs: number;
  lastTickMs: number | null;
  startedAtMs: number | null;
  progress: ExerciseProgress[];
}

export type SessionAction =
  | { type: 'START'; nowMs: number }
  | { type: 'SET_DONE'; reps?: number }
  | { type: 'TICK'; nowMs: number }
  | { type: 'SKIP_REST' }
  | { type: 'SKIP_EXERCISE' }
  | { type: 'PAUSE'; nowMs: number }
  | { type: 'RESUME'; nowMs: number }
  | { type: 'STOP' };

export function initialSessionState(exerciseCount: number): SessionMachineState {
  return {
    phase: 'ready',
    resumePhase: 'work',
    exerciseIndex: 0,
    setIndex: 0,
    repsPerSet: [],
    secondsRemaining: null,
    activeMs: 0,
    lastTickMs: null,
    startedAtMs: null,
    progress: Array.from({ length: exerciseCount }, () => ({
      status: 'skipped' as SessionExerciseStatus,
      completedSets: 0,
      completedReps: null,
      activeMs: 0,
    })),
  };
}

export function currentExercise(
  state: SessionMachineState,
  exercises: Exercise[],
): Exercise | null {
  if (state.exerciseIndex < 0 || state.exerciseIndex >= exercises.length) {
    return null;
  }
  return exercises[state.exerciseIndex] ?? null;
}

function emptyProgress(): ExerciseProgress {
  return { status: 'skipped', completedSets: 0, completedReps: null, activeMs: 0 };
}

/**
 * Advances to the next unit of work, inserting rest only where the plan calls for it: after a set
 * when more sets remain, and after an exercise's last set only if another exercise follows.
 * Result statuses are derived later by `buildResults`, so nothing is written here.
 */
function advance(
  state: SessionMachineState,
  exercises: Exercise[],
  restSeconds: number,
): SessionMachineState {
  const exercise = currentExercise(state, exercises);
  if (!exercise) {
    return { ...state, phase: 'finished', secondsRemaining: null };
  }

  const hasMoreSets = state.setIndex + 1 < exercise.sets;
  const hasMoreExercises = state.exerciseIndex + 1 < exercises.length;
  const entersRest = restSeconds > 0;

  if (hasMoreSets) {
    return {
      ...state,
      setIndex: state.setIndex + 1,
      phase: entersRest ? 'rest' : 'work',
      secondsRemaining: entersRest ? restSeconds : null,
    };
  }

  if (!hasMoreExercises) {
    return { ...state, exerciseIndex: exercises.length, phase: 'finished', secondsRemaining: null };
  }

  return {
    ...state,
    exerciseIndex: state.exerciseIndex + 1,
    setIndex: 0,
    phase: entersRest ? 'rest' : 'work',
    secondsRemaining: entersRest ? restSeconds : null,
  };
}

function withProgress(
  state: SessionMachineState,
  index: number,
  patch: Partial<ExerciseProgress>,
): ExerciseProgress[] {
  const out = state.progress.map((p) => ({ ...p }));
  const current = out[index] ?? emptyProgress();
  const status: SessionExerciseStatus =
    current.completedSets >= 1 ? (current.status === 'completed' ? 'completed' : 'partial') : 'skipped';
  out[index] = { ...current, ...patch, status: patch.status ?? status };
  return out;
}

/** Applies an action. Never throws; unknown actions return the state unchanged. */
export function sessionReducer(
  state: SessionMachineState,
  action: SessionAction,
  exercises: Exercise[],
): SessionMachineState {
  const exercise = currentExercise(state, exercises);

  switch (action.type) {
    case 'START': {
      if (exercises.length === 0) {
        return state;
      }
      const first = exercises[0];
      return {
        ...state,
        phase: 'work',
        startedAtMs: action.nowMs,
        lastTickMs: action.nowMs,
        secondsRemaining: first?.durationSeconds ?? null,
      };
    }

    case 'PAUSE': {
      if (state.phase === 'paused' || state.phase === 'finished' || state.phase === 'stopped') {
        return state;
      }
      const frozen = applyActiveTime(state, null);
      return {
        ...frozen,
        phase: 'paused',
        resumePhase: state.phase === 'ready' ? 'work' : state.phase,
        lastTickMs: null,
      };
    }

    case 'RESUME': {
      if (state.phase !== 'paused') {
        return state;
      }
      return { ...state, phase: state.resumePhase, lastTickMs: action.nowMs };
    }

    case 'STOP':
      return { ...state, phase: 'stopped', lastTickMs: null };

    case 'SKIP_REST':
      if (state.phase !== 'rest') {
        return state;
      }
      return { ...state, phase: 'work', secondsRemaining: null };

    case 'SKIP_EXERCISE': {
      if (state.phase === 'finished' || state.phase === 'stopped') {
        return state;
      }
      if (!exercise) {
        return state;
      }
      // Skipping covers the WHOLE exercise, so its remaining sets are jumped over at once.
      // Reaching 0 sets keeps the derived status `skipped`; a partial one stays `partial`.
      const exhausted: SessionMachineState = { ...state, setIndex: exercise.sets };
      return advance(exhausted, exercises, exercise.restSeconds ?? 0);
    }

    case 'SET_DONE': {
      if (state.phase !== 'work' || !exercise) {
        return state;
      }
      const index = state.exerciseIndex;
      const previous = state.progress[index] ?? emptyProgress();
      const reps = action.reps ?? exercise.reps ?? null;
      const completedReps =
        exercise.reps === null ? null : (previous.completedReps ?? 0) + (reps ?? 0);
      const progressed = withProgress(state, index, {
        completedSets: previous.completedSets + 1,
        completedReps,
      });
      const withSet: SessionMachineState = { ...state, progress: progressed };
      return advance(withSet, exercises, exercise.restSeconds ?? 0);
    }

    case 'TICK': {
      if (state.phase === 'paused' || state.phase === 'finished' || state.phase === 'stopped') {
        return state;
      }
      if (state.phase === 'ready') {
        return state;
      }
      const timed = applyActiveTime(state, action.nowMs);

      if (timed.phase === 'rest') {
        if (timed.secondsRemaining === null || timed.secondsRemaining <= 0) {
          return { ...timed, phase: 'work', secondsRemaining: null };
        }
        return timed;
      }

      // Work phase.
      if (exercise && exercise.durationSeconds !== null && timed.secondsRemaining !== null) {
        if (timed.secondsRemaining <= 0) {
          return sessionReducer(timed, { type: 'SET_DONE' }, exercises);
        }
        return timed;
      }
      // Rep-only exercise: no countdown, just accumulating active time.
      return timed;
    }

    default:
      return state;
  }
}

/**
 * Moves the active-time accumulator forward using wall-clock deltas, so a backgrounded app or a
 * slow frame still counts the real elapsed time. Paused time is never added.
 */
function applyActiveTime(state: SessionMachineState, nowMs: number | null): SessionMachineState {
  if (state.lastTickMs === null || nowMs === null) {
    return state;
  }
  const delta = nowMs - state.lastTickMs;
  if (delta <= 0) {
    return { ...state, lastTickMs: nowMs };
  }
  if (state.phase === 'rest' || state.phase === 'ready') {
    const secondsRemaining =
      state.secondsRemaining === null
        ? null
        : Math.max(0, state.secondsRemaining - Math.round(delta / 1000));
    return { ...state, activeMs: state.activeMs, secondsRemaining, lastTickMs: nowMs };
  }
  const index = state.exerciseIndex;
  const previous = state.progress[index] ?? emptyProgress();
  const progress = withProgress(state, index, { activeMs: previous.activeMs + delta });
  const secondsRemaining =
    state.secondsRemaining === null
      ? null
      : Math.max(0, state.secondsRemaining - Math.round(delta / 1000));
  return { ...state, activeMs: state.activeMs + delta, secondsRemaining, progress, lastTickMs: nowMs };
}

/** LOCAL-WORKAROUND (internal): true once at least one set has been completed in the session. */
export function hasAnyCompletedSet(state: SessionMachineState): boolean {
  return state.progress.some((p) => p.completedSets > 0);
}

/**
 * Builds the `SaveSessionInput['results']` array. Exercises never reached, or explicitly skipped,
 * are recorded as `skipped` so the history still shows the plan.
 */
export function buildResults(
  state: SessionMachineState,
  exercises: Exercise[],
): SaveSessionInput['results'] {
  return exercises.map((exercise, index) => {
    const progress = state.progress[index] ?? emptyProgress();
    const status: SessionExerciseStatus =
      progress.completedSets >= exercise.sets
        ? 'completed'
        : progress.completedSets > 0
          ? 'partial'
          : 'skipped';
    const completedReps =
      exercise.reps === null ? null : (progress.completedReps ?? progress.completedSets * exercise.reps);
    return {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      plannedSets: exercise.sets,
      plannedReps: exercise.reps,
      plannedDurationSeconds: exercise.durationSeconds,
      completedSets: Math.min(progress.completedSets, exercise.sets),
      completedReps,
      activeSeconds: Math.round(progress.activeMs / 1000),
      status,
      intensity: exercise.intensity as ExerciseIntensity | null,
      sortOrder: index,
    };
  });
}