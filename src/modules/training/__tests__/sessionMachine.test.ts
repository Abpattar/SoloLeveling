/** @jest-environment node */
import {
  buildResults,
  currentExercise,
  hasAnyCompletedSet,
  initialSessionState,
  sessionReducer,
} from '../domain/sessionMachine';
import type { SessionMachineState } from '../domain/sessionMachine';
import type { Exercise, Weekday } from '@/shared/types/training';

function exercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'e1',
    name: 'Straight leg raise',
    instructions: null,
    sets: 2,
    reps: 10,
    durationSeconds: null,
    restSeconds: 30,
    scheduleDays: [1] as Weekday[],
    clinicianNotes: null,
    intensity: 'light',
    status: 'active',
    sortOrder: 0,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

const T0 = 1_000_000;

function reduce(state: SessionMachineState, exercises: Exercise[], ...actions: Parameters<typeof sessionReducer>[1][]): SessionMachineState {
  return actions.reduce((acc, action) => sessionReducer(acc, action, exercises), state);
}

describe('rep-exercise flow', () => {
  const exercises = [exercise({ sets: 2, reps: 10, restSeconds: 30 })];

  it('starts in the work phase with no countdown for rep exercises', () => {
    const state = reduce(initialSessionState(1), exercises, { type: 'START', nowMs: T0 });
    expect(state.phase).toBe('work');
    expect(state.secondsRemaining).toBeNull();
    expect(currentExercise(state, exercises)?.name).toBe('Straight leg raise');
  });

  it('enters rest after the first set and back to work after it', () => {
    const state = reduce(
      initialSessionState(1),
      exercises,
      { type: 'START', nowMs: T0 },
      { type: 'SET_DONE' },
    );
    expect(state.phase).toBe('rest');
    expect(state.secondsRemaining).toBe(30);
    expect(state.setIndex).toBe(1);

    const afterRest = sessionReducer(state, { type: 'SKIP_REST' }, exercises);
    expect(afterRest.phase).toBe('work');
    expect(afterRest.secondsRemaining).toBeNull();
  });

  it('finishes after the last set and records the planned reps', () => {
    const state = reduce(
      initialSessionState(1),
      exercises,
      { type: 'START', nowMs: T0 },
      { type: 'SET_DONE' },
      { type: 'SKIP_REST' },
      { type: 'SET_DONE' },
    );
    expect(state.phase).toBe('finished');
    const results = buildResults(state, exercises);
    expect(results[0]).toMatchObject({
      status: 'completed',
      completedSets: 2,
      completedReps: 20,
      exerciseName: 'Straight leg raise',
      intensity: 'light',
    });
  });

  it('records an adjusted rep count when the user did fewer', () => {
    const state = reduce(
      initialSessionState(1),
      exercises,
      { type: 'START', nowMs: T0 },
      { type: 'SET_DONE', reps: 6 },
      { type: 'SKIP_REST' },
      { type: 'SET_DONE', reps: 8 },
    );
    expect(buildResults(state, exercises)[0]?.completedReps).toBe(14);
  });

  it('skips rest entirely when restSeconds is 0', () => {
    const noRest = [exercise({ sets: 2, reps: 5, restSeconds: 0 })];
    const state = reduce(
      initialSessionState(1),
      noRest,
      { type: 'START', nowMs: T0 },
      { type: 'SET_DONE' },
    );
    expect(state.phase).toBe('work');
    expect(state.setIndex).toBe(1);
  });
});

describe('duration-exercise flow', () => {
  const exercises = [exercise({ sets: 1, reps: null, durationSeconds: 3, restSeconds: 0 })];

  it('counts down the work timer and auto-completes the set at zero', () => {
    let state = reduce(initialSessionState(1), exercises, { type: 'START', nowMs: T0 });
    expect(state.secondsRemaining).toBe(3);

    state = sessionReducer(state, { type: 'TICK', nowMs: T0 + 1000 }, exercises);
    expect(state.secondsRemaining).toBe(2);

    state = sessionReducer(state, { type: 'TICK', nowMs: T0 + 3000 }, exercises);
    expect(state.phase).toBe('finished');
    const results = buildResults(state, exercises);
    expect(results[0]?.status).toBe('completed');
    expect(results[0]?.completedReps).toBeNull();
    expect(results[0]?.completedSets).toBe(1);
  });

  it('counts active time for a duration exercise', () => {
    let state = reduce(initialSessionState(1), exercises, { type: 'START', nowMs: T0 });
    state = sessionReducer(state, { type: 'TICK', nowMs: T0 + 3000 }, exercises);
    expect(buildResults(state, exercises)[0]?.activeSeconds).toBe(3);
  });
});

describe('rest rules across exercises', () => {
  const exercises = [
    exercise({ id: 'a', name: 'A', sets: 1, reps: 5, restSeconds: 45 }),
    exercise({ id: 'b', name: 'B', sets: 1, reps: 5, restSeconds: 45 }),
  ];

  it('rests between exercises but not after the last one', () => {
    const state = reduce(
      initialSessionState(2),
      exercises,
      { type: 'START', nowMs: T0 },
      { type: 'SET_DONE' },
    );
    expect(state.phase).toBe('rest');
    expect(state.exerciseIndex).toBe(1);

    const finished = sessionReducer(state, { type: 'SKIP_REST' }, exercises);
    expect(finished.phase).toBe('work');

    const last = sessionReducer(finished, { type: 'SET_DONE' }, exercises);
    expect(last.phase).toBe('finished');
    expect(last.exerciseIndex).toBe(2);
  });

  it('counts down the rest timer on its own', () => {
    const state = reduce(
      initialSessionState(2),
      exercises,
      { type: 'START', nowMs: T0 },
      { type: 'SET_DONE' },
    );
    const later = sessionReducer(state, { type: 'TICK', nowMs: T0 + 45_000 }, exercises);
    expect(later.phase).toBe('work');
  });
});

describe('skip and stop', () => {
  const exercises = [
    exercise({ id: 'a', name: 'A', sets: 2, reps: 5, restSeconds: 0 }),
    exercise({ id: 'b', name: 'B', sets: 1, reps: 5, restSeconds: 0 }),
  ];

  it('marks an untouched exercise as skipped and moves on', () => {
    const state = reduce(
      initialSessionState(2),
      exercises,
      { type: 'START', nowMs: T0 },
      { type: 'SKIP_EXERCISE' },
    );
    expect(state.exerciseIndex).toBe(1);
    const results = buildResults(state, exercises);
    expect(results[0]?.status).toBe('skipped');
    expect(results[0]?.completedSets).toBe(0);
    expect(results[1]?.status).toBe('skipped');
  });

  it('keeps a partially done exercise as partial', () => {
    const state = reduce(
      initialSessionState(2),
      exercises,
      { type: 'START', nowMs: T0 },
      { type: 'SET_DONE' },
      { type: 'SKIP_EXERCISE' },
    );
    expect(buildResults(state, exercises)[0]?.status).toBe('partial');
    expect(buildResults(state, exercises)[0]?.completedSets).toBe(1);
  });

  it('stops immediately and keeps everything already done', () => {
    const state = reduce(
      initialSessionState(2),
      exercises,
      { type: 'START', nowMs: T0 },
      { type: 'SET_DONE' },
      { type: 'STOP' },
    );
    expect(state.phase).toBe('stopped');
    expect(hasAnyCompletedSet(state)).toBe(true);
    expect(buildResults(state, exercises)[0]?.status).toBe('partial');
    expect(buildResults(state, exercises)[1]?.status).toBe('skipped');
  });

  it('reports nothing completed when stopped before the first set', () => {
    const state = reduce(
      initialSessionState(2),
      exercises,
      { type: 'START', nowMs: T0 },
      { type: 'STOP' },
    );
    expect(hasAnyCompletedSet(state)).toBe(false);
  });

  it('ignores ticks and actions once stopped or finished', () => {
    const stopped = reduce(initialSessionState(2), exercises, { type: 'START', nowMs: T0 }, { type: 'STOP' });
    expect(sessionReducer(stopped, { type: 'TICK', nowMs: T0 + 5000 }, exercises)).toBe(stopped);
    expect(sessionReducer(stopped, { type: 'SET_DONE' }, exercises)).toBe(stopped);
  });
});

describe('pause and resume', () => {
  const exercises = [exercise({ sets: 1, reps: null, durationSeconds: 10, restSeconds: 0 })];

  it('freezes the countdown and does not accumulate active time while paused', () => {
    let state = reduce(initialSessionState(1), exercises, { type: 'START', nowMs: T0 });
    state = sessionReducer(state, { type: 'TICK', nowMs: T0 + 2000 }, exercises);
    expect(state.secondsRemaining).toBe(8);

    state = sessionReducer(state, { type: 'PAUSE', nowMs: T0 + 2000 }, exercises);
    expect(state.phase).toBe('paused');

    const still = sessionReducer(state, { type: 'TICK', nowMs: T0 + 60_000 }, exercises);
    expect(still.secondsRemaining).toBe(8);
    expect(buildResults(still, exercises)[0]?.activeSeconds).toBe(2);
  });

  it('resumes from the same countdown position', () => {
    let state = reduce(initialSessionState(1), exercises, { type: 'START', nowMs: T0 });
    state = sessionReducer(state, { type: 'TICK', nowMs: T0 + 2000 }, exercises);
    state = sessionReducer(state, { type: 'PAUSE', nowMs: T0 + 2000 }, exercises);
    state = sessionReducer(state, { type: 'TICK', nowMs: T0 + 90_000 }, exercises);
    state = sessionReducer(state, { type: 'RESUME', nowMs: T0 + 90_000 }, exercises);
    expect(state.phase).toBe('work');
    expect(state.secondsRemaining).toBe(8);
  });

  it('resuming when not paused does nothing', () => {
    const state = reduce(initialSessionState(1), exercises, { type: 'START', nowMs: T0 });
    expect(sessionReducer(state, { type: 'RESUME', nowMs: T0 }, exercises)).toBe(state);
  });
});

describe('active time accounting (GAT-004)', () => {
  it('uses wall-clock deltas, so a backgrounded app still counts correctly', () => {
    const exercises = [exercise({ sets: 3, reps: 5, restSeconds: 0 })];
    const state = reduce(
      initialSessionState(1),
      exercises,
      { type: 'START', nowMs: T0 },
      { type: 'TICK', nowMs: T0 + 20_000 },
      { type: 'SET_DONE' },
    );
    expect(buildResults(state, exercises)[0]?.activeSeconds).toBe(20);
  });

  it('ignores a backwards clock jump instead of going negative', () => {
    const exercises = [exercise({ sets: 1, reps: null, durationSeconds: 30, restSeconds: 0 })];
    const state = reduce(
      initialSessionState(1),
      exercises,
      { type: 'START', nowMs: T0 },
      { type: 'TICK', nowMs: T0 - 5000 },
    );
    expect(buildResults(state, exercises)[0]?.activeSeconds).toBe(0);
  });
});

describe('buildResults (GAT-004)', () => {
  it('sorts results by plan position and snapshots intensity', () => {
    const exercises = [
      exercise({ id: 'a', name: 'A', sets: 1, reps: 4, restSeconds: 0, intensity: 'moderate' }),
      exercise({ id: 'b', name: 'B', sets: 1, durationSeconds: 30, reps: null, restSeconds: 0, intensity: null }),
    ];
    const state = reduce(
      initialSessionState(2),
      exercises,
      { type: 'START', nowMs: T0 },
      { type: 'SET_DONE' },
      { type: 'TICK', nowMs: T0 + 30_000 },
    );
    const results = buildResults(state, exercises);
    expect(results.map((r) => r.exerciseName)).toEqual(['A', 'B']);
    expect(results.map((r) => r.sortOrder)).toEqual([0, 1]);
    expect(results[0]?.intensity).toBe('moderate');
    expect(results[1]?.intensity).toBeNull();
    expect(results[1]?.plannedDurationSeconds).toBe(30);
  });

  it('never reports more completed sets than planned', () => {
    const exercises = [exercise({ sets: 1, reps: 5, restSeconds: 0 })];
    const state = reduce(
      initialSessionState(1),
      exercises,
      { type: 'START', nowMs: T0 },
      { type: 'SET_DONE' },
      { type: 'SET_DONE' },
      { type: 'SET_DONE' },
    );
    expect(buildResults(state, exercises)[0]?.completedSets).toBeLessThanOrEqual(1);
  });
});

describe('GAT-005 — the machine cannot modify the plan', () => {
  it('does not mutate the exercise objects it was given', () => {
    const exercises = [exercise({ sets: 2, reps: 10, restSeconds: 30 })];
    const snapshot = JSON.stringify(exercises);
    reduce(
      initialSessionState(1),
      exercises,
      { type: 'START', nowMs: T0 },
      { type: 'SET_DONE', reps: 2 },
      { type: 'SKIP_REST' },
      { type: 'SET_DONE', reps: 2 },
      { type: 'STOP' },
    );
    expect(JSON.stringify(exercises)).toBe(snapshot);
  });
});