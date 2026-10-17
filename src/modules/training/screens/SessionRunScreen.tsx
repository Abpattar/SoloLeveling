/**
 * INTEGRATION CONTRACT: CMP-TRN-003
 * Purpose: session mode — one exercise at a time, set counter, rest timer, pause/skip/stop. On finish
 *          or stop it saves the session and moves to the completion screen. It never edits the plan.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CMP-TRN-003), REQ-SES-001/002
 * Consumers: src/app/session/run.tsx (A7)
 * Contract status: APPROVED
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
// CONTRACT: API-TRN-007/008 (A2) — which exercises are planned, and saving the result
import { listExercises, listExercisesScheduledFor, saveSession } from '@/modules/training';
import { useSessionRunner } from '@/modules/training/hooks/useSessionRunner';
import { ROUTES } from '@/shared/navigation/routes';
import { confirmAction } from '@/shared/ui/confirmAction';
import { Screen } from '@/shared/ui/Screen';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState, ErrorBanner, LoadingView } from '@/shared/ui/feedback';
import { useFocusLoad } from '@/shared/ui/useFocusLoad';
import { useTheme } from '@/shared/ui/theme';
import { nowIso, todayLocal } from '@/shared/utils/dates';
import { toAppError } from '@/shared/errors/AppError';
import type { Exercise } from '@/shared/types/training';

export interface SessionRunScreenProps {
  plannedExerciseIds: string[] | null;
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function SessionRunScreen({ plannedExerciseIds }: SessionRunScreenProps): React.JSX.Element {
  const theme = useTheme();
  const [error, setError] = useState<string | null>(null);
  const startedAtRef = useRef(nowIso());
  const [plannedReps, setPlannedReps] = useState(0);

const load = useCallback(async (): Promise<Exercise[]> => {
if (plannedExerciseIds !== null && plannedExerciseIds.length > 0) {
const all = await listExercises();
const wanted = new Set(plannedExerciseIds);
return all.filter((exercise) => wanted.has(exercise.id));
}
// No explicit plan: today's scheduled exercises, or every active exercise if none are scheduled.
const scheduled = await listExercisesScheduledFor(todayLocal());
return scheduled.length > 0 ? scheduled : listExercises();
}, [plannedExerciseIds]);

  const { data: exercises, loading, error: loadError } = useFocusLoad(load, [plannedExerciseIds]);

  const runner = useSessionRunner(exercises ?? []);
  const { state, exercise, dispatch } = runner;

  useEffect(() => {
    if (state.phase === 'ready' && (exercises ?? []).length > 0) {
      dispatch({ type: 'START', nowMs: Date.now() });
    }
  }, [state.phase, exercises, dispatch]);

  useEffect(() => {
    // Keeping the on-screen rep target in step with the exercise being shown.
    if (exercise) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlannedReps(exercise.reps ?? 0);
    }
  }, [exercise]);

  const finish = useCallback(
    async (status: 'completed' | 'stopped'): Promise<void> => {
      const endedAt = nowIso();
      const input = runner.buildInput(status, startedAtRef.current, endedAt);
      if (input === null) {
        router.back();
        return;
      }
      setError(null);
      try {
        const session = await saveSession(input);
        router.replace(ROUTES.sessionComplete(session.id));
      } catch (e) {
        setError(toAppError(e).message);
      }
    },
    [runner],
  );

  useEffect(() => {
    // Saving is a side effect of the machine reaching "finished".
    if (state.phase === 'finished') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void finish('completed');
    }
    // `finish` is stable enough; re-running on every render would save twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  const onStop = async (): Promise<void> => {
    const ok = await confirmAction({
      title: 'Stop this session?',
      message: 'What you have already done will be saved. The rest stays on your plan.',
      confirmLabel: 'Stop and save',
    });
    if (ok) {
      dispatch({ type: 'STOP' });
      await finish('stopped');
    }
  };

  const volumeLabel = useMemo(() => {
    if (!exercise) {
      return '';
    }
    return exercise.reps !== null
      ? `${exercise.sets} sets of ${exercise.reps} reps`
      : `${exercise.sets} sets of ${Math.round((exercise.durationSeconds ?? 0) / 60)} min`;
  }, [exercise]);

  if (loading) {
    return (
      <Screen>
        <LoadingView />
      </Screen>
    );
  }

  if ((exercises ?? []).length === 0) {
    return (
      <Screen>
        <EmptyState
          title="Nothing to do right now"
          message="There are no active exercises scheduled for today."
          action={{ label: 'Back', onPress: () => router.back() }}
        />
      </Screen>
    );
  }

  const isRest = state.phase === 'rest';
  const isPaused = state.phase === 'paused';

  return (
    <Screen scroll={false}>
      <AppText variant="title">{isRest ? 'Rest' : isPaused ? 'Paused' : 'Session'}</AppText>
      <ErrorBanner error={error ?? loadError} />

      {!exercise && state.phase !== 'finished' ? (
        <EmptyState
          title="Nothing to do right now"
          message="There are no active exercises scheduled for today."
          action={{ label: 'Back', onPress: () => router.back() }}
        />
      ) : null}

      {exercise && state.phase !== 'finished' ? (
        <Card>
          <AppText variant="heading" style={{ marginBottom: 0 }}>
            {exercise.name}
          </AppText>
          <AppText variant="caption" muted>
            {volumeLabel}
          </AppText>
          {exercise.instructions ? <AppText>{exercise.instructions}</AppText> : null}
          {exercise.clinicianNotes ? (
            <AppText variant="caption" muted>
              Clinician notes: {exercise.clinicianNotes}
            </AppText>
          ) : null}
        </Card>
      ) : null}

      {isRest ? (
        <View style={{ alignItems: 'center', paddingVertical: theme.spacing.xl }}>
          <AppText variant="title" style={{ fontSize: 48, marginBottom: 0 }}>
            {formatClock(state.secondsRemaining ?? 0)}
          </AppText>
          <AppText muted>Rest before the next set</AppText>
          <View style={{ alignSelf: 'stretch', marginTop: theme.spacing.md }}>
            <Button label="Skip rest" onPress={() => dispatch({ type: 'SKIP_REST' })} />
          </View>
        </View>
      ) : null}

      {!isRest && exercise && state.phase !== 'finished' ? (
        <View style={{ alignItems: 'center', paddingVertical: theme.spacing.lg }}>
          <AppText muted>
            Set {Math.min(state.setIndex + 1, exercise.sets)} of {exercise.sets}
          </AppText>
          {exercise.reps !== null ? (
            <>
              <AppText variant="title" style={{ fontSize: 44, marginBottom: 0 }}>
                {plannedReps} reps
              </AppText>
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <Button
                  label="Reps −1"
                  variant="secondary"
                  onPress={() => setPlannedReps((n) => Math.max(1, n - 1))}
                />
                <Button label="Reps +1" variant="secondary" onPress={() => setPlannedReps((n) => n + 1)} />
              </View>
              <View style={{ alignSelf: 'stretch', marginTop: theme.spacing.md }}>
                <Button label="Set done" onPress={() => dispatch({ type: 'SET_DONE', reps: plannedReps })} />
              </View>
            </>
          ) : (
            <>
              <AppText variant="title" style={{ fontSize: 44, marginBottom: 0 }}>
                {formatClock(state.secondsRemaining ?? exercise.durationSeconds ?? 0)}
              </AppText>
              <View style={{ alignSelf: 'stretch', marginTop: theme.spacing.md }}>
                <Button label="Set done" onPress={() => dispatch({ type: 'SET_DONE' })} />
              </View>
            </>
          )}
        </View>
      ) : null}

      <View style={{ gap: theme.spacing.sm, marginTop: 'auto' }}>
        {!isPaused && state.phase !== 'finished' ? (
          <Button label="Pause" variant="secondary" onPress={() => dispatch({ type: 'PAUSE', nowMs: Date.now() })} />
        ) : null}
        {isPaused ? (
          <Button label="Resume" onPress={() => dispatch({ type: 'RESUME', nowMs: Date.now() })} />
        ) : null}
        {state.phase !== 'finished' ? (
          <Button label="Skip this exercise" variant="ghost" onPress={() => dispatch({ type: 'SKIP_EXERCISE' })} />
        ) : null}
        {state.phase !== 'finished' ? (
          <Button label="Stop session" variant="danger" onPress={() => void onStop()} />
        ) : null}
      </View>
    </Screen>
  );
}