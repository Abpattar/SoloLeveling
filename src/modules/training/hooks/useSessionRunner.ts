/**
 * INTEGRATION CONTRACT: internal (A2 training)
 * Purpose: drives `sessionMachine` with a one-second ticker and haptic cues. Elapsed time is taken
 *          from wall-clock timestamps, never from how many ticks fired, so a backgrounded app or a
 *          slow frame cannot make a rest timer run long or short.
 * Canonical definition: AGENT_02_PROMPT.md §3 (`hooks/useSessionRunner.ts`)
 * Consumers: SessionRunScreen.tsx
 * Contract status: APPROVED (internal symbol, no registry ID)
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { AppState, Vibration } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { buildResults, currentExercise, initialSessionState, sessionReducer } from '../domain/sessionMachine';
import type { SessionAction, SessionMachineState } from '../domain/sessionMachine';
import type { Exercise, SaveSessionInput } from '@/shared/types/training';

const TICK_MS = 1000;

export interface SessionRunner {
  state: SessionMachineState;
  exercise: Exercise | null;
  dispatch(action: SessionAction): void;
  /** Builds the payload for `saveSession`; `null` when nothing at all was completed. */
  buildInput(status: 'completed' | 'stopped', startedAt: string, endedAt: string): SaveSessionInput | null;
}

export function useSessionRunner(exercises: Exercise[]): SessionRunner {
  const [state, dispatch] = useReducer(
    (current: SessionMachineState, action: SessionAction) =>
      sessionReducer(current, action, exercises),
    exercises.length,
    initialSessionState,
  );

  useKeepAwake('recovery-fitness-session');

  const exercise = useMemo(() => currentExercise(state, exercises), [state, exercises]);

  useEffect(() => {
    if (state.phase === 'finished' || state.phase === 'stopped' || state.phase === 'paused') {
      return undefined;
    }
    const handle = setInterval(() => {
      dispatch({ type: 'TICK', nowMs: Date.now() });
    }, TICK_MS);
    return () => clearInterval(handle);
  }, [state.phase]);

  // Coming back from the background must not silently swallow elapsed time.
  const phaseRef = useRef(state.phase);
  useEffect(() => {
    phaseRef.current = state.phase;
  });
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active' && phaseRef.current !== 'paused') {
        dispatch({ type: 'TICK', nowMs: Date.now() });
      }
    });
    return () => subscription.remove();
  }, []);

  const buzz = useCallback(() => {
    try {
      Vibration.vibrate(120);
    } catch {
      // Haptics are optional feedback; a device without a vibrator must not break the session.
    }
  }, []);

  const dispatchWithFeedback = useCallback(
    (action: SessionAction) => {
      if (action.type === 'SET_DONE' || action.type === 'SKIP_EXERCISE') {
        buzz();
      }
      dispatch(action);
    },
    [buzz],
  );

  const buildInput = useCallback(
    (status: 'completed' | 'stopped', startedAt: string, endedAt: string): SaveSessionInput | null => {
      const results = buildResults(state, exercises);
      if (results.every((r) => r.status === 'skipped')) {
        return null;
      }
      return {
        startedAt,
        endedAt,
        status,
        totalDurationSeconds: Math.max(
          Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 1000),
          0,
        ),
        results,
      };
    },
    [state, exercises],
  );

  return { state, exercise, dispatch: dispatchWithFeedback, buildInput };
}