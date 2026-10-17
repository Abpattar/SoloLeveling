/**
 * INTEGRATION CONTRACT: CMP-TRN-001
 * Purpose: the user's own exercise list with add / edit / pause / reorder / delete, plus the entry
 *          point into session mode. Nothing here ever suggests, adds or changes an exercise.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CMP-TRN-001), REQ-EXR-001/002
 * Consumers: src/app/(tabs)/exercises.tsx (A7)
 * Contract status: APPROVED
 */
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
// CONTRACT: API-TRN-001..006 (A2) — the list and its mutations
import {
  deleteExercise,
  listExercises,
  reorderExercises,
  updateExercise,
} from '@/modules/training';
// CONTRACT: CONST-NAV-001 (A1) — route builders
import { ROUTES } from '@/shared/navigation/routes';
// CONTRACT: HOOK-UI-002 (A1) — reload on focus
import { useFocusLoad } from '@/shared/ui/useFocusLoad';
// CONTRACT: API-UI-001 (A1) — confirmation before a destructive action
import { confirmAction } from '@/shared/ui/confirmAction';
import { Screen } from '@/shared/ui/Screen';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Chip } from '@/shared/ui/Chip';
import { EmptyState, ErrorBanner, LoadingView } from '@/shared/ui/feedback';
import { useTheme } from '@/shared/ui/theme';
import type { Exercise } from '@/shared/types/training';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function describeSchedule(exercise: Exercise): string {
  const days = exercise.scheduleDays.map((d) => WEEKDAY_LABELS[d - 1] ?? '?').join(', ');
  const volume =
    exercise.reps !== null
      ? `${exercise.sets} x ${exercise.reps} reps`
      : `${exercise.sets} x ${Math.round((exercise.durationSeconds ?? 0) / 60)} min`;
  const rest = exercise.restSeconds > 0 ? ` rest ${exercise.restSeconds}s` : ' no rest';
  return `${volume} · ${rest} · ${days}`;
}

export function ExerciseListScreen(): React.JSX.Element {
  const theme = useTheme();
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(() => listExercises({ includePaused: true }), []);
  const { data, loading, error, reload } = useFocusLoad(load, []);

  const move = async (index: number, direction: -1 | 1): Promise<void> => {
    if (!data) {
      return;
    }
    const next = data.map((e) => e.id);
    const target = index + direction;
    if (target < 0 || target >= next.length) {
      return;
    }
    const swapped = [...next];
    const tmp = swapped[index] as string;
    swapped[index] = swapped[target] as string;
    swapped[target] = tmp;
    setBusy('reorder');
    try {
      await reorderExercises(swapped);
      reload();
    } finally {
      setBusy(null);
    }
  };

  const togglePause = async (exercise: Exercise): Promise<void> => {
    setBusy(exercise.id);
    try {
      await updateExercise(exercise.id, {
        status: exercise.status === 'active' ? 'paused' : 'active',
      });
      reload();
    } finally {
      setBusy(null);
    }
  };

  const remove = async (exercise: Exercise): Promise<void> => {
    const ok = await confirmAction({
      title: 'Remove this exercise?',
      message: `"${exercise.name}" will be removed from your list. Past sessions keep their record.`,
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) {
      return;
    }
    setBusy(exercise.id);
    try {
      await deleteExercise(exercise.id);
      reload();
    } finally {
      setBusy(null);
    }
  };

  const active = (data ?? []).filter((e) => e.status === 'active');

  return (
    <Screen>
      <AppText variant="title">Your exercises</AppText>
      <AppText muted>
        This list is yours alone. Enter only the exercises your clinician has cleared you to do — the
        app never adds, changes or progresses anything on its own.
      </AppText>

      <ErrorBanner error={error} />

      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
        <View style={{ flex: 1 }}>
          <Button
            label="Add exercise"
            onPress={() => router.push(ROUTES.exerciseNew)}
            disabled={busy !== null}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label="Start session"
            variant="secondary"
            onPress={() => router.push(ROUTES.sessionRun())}
            disabled={active.length === 0 || busy !== null}
          />
        </View>
      </View>

      <Button
        label="Session history"
        variant="ghost"
        onPress={() => router.push(ROUTES.sessionHistory)}
        disabled={busy !== null}
      />

      {loading && !data ? <LoadingView /> : null}

      {!loading && (data ?? []).length === 0 ? (
        <EmptyState
          title="No exercises yet"
          message="Add the exercises from your rehabilitation plan, then schedule the days you were told to do them."
          action={{ label: 'Add exercise', onPress: () => router.push(ROUTES.exerciseNew) }}
        />
      ) : null}

      {(data ?? []).map((exercise, index) => (
        <Card key={exercise.id}>
          <AppText variant="heading" style={{ marginBottom: 0 }}>
            {exercise.name}
          </AppText>
          <AppText variant="caption" muted>
            {describeSchedule(exercise)}
          </AppText>
          {exercise.intensity ? (
            <AppText variant="caption" muted>
              Intensity: {exercise.intensity}
            </AppText>
          ) : null}
          {exercise.clinicianNotes ? (
            <AppText variant="caption" muted>
              Clinician notes: {exercise.clinicianNotes}
            </AppText>
          ) : null}
          <View style={{ flexDirection: 'row', marginTop: theme.spacing.sm, gap: theme.spacing.xs }}>
            <Chip
              label={exercise.status === 'active' ? 'Active' : 'Paused'}
              selected={exercise.status === 'paused'}
            />
          </View>

          <View style={{ marginTop: theme.spacing.sm, gap: theme.spacing.xs }}>
            <Button
              label="Edit"
              variant="secondary"
              onPress={() => router.push(ROUTES.exerciseEdit(exercise.id))}
              disabled={busy !== null}
            />
            <Button
              label={exercise.status === 'active' ? 'Pause' : 'Resume'}
              variant="secondary"
              onPress={() => void togglePause(exercise)}
              disabled={busy !== null}
            />
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button
                  label="Move up"
                  variant="ghost"
                  onPress={() => void move(index, -1)}
                  disabled={busy !== null || index === 0}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="Move down"
                  variant="ghost"
                  onPress={() => void move(index, 1)}
                  disabled={busy !== null || index === (data ?? []).length - 1}
                />
              </View>
            </View>
            <Button
              label="Remove"
              variant="danger"
              onPress={() => void remove(exercise)}
              disabled={busy !== null}
            />
          </View>
        </Card>
      ))}
    </Screen>
  );
}