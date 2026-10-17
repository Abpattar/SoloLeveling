/**
 * INTEGRATION CONTRACT: CMP-TRN-007
 * Purpose: the Today card — today's planned exercises, whether they are done, and the entry point
 *          into session mode. Reads only; it never changes the plan.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CMP-TRN-007), REQ-SES-006
 * Consumers: src/shell/TodayScreen.tsx (A7)
 * Contract status: APPROVED
 */
import React, { useCallback } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
// CONTRACT: API-TRN-007/014 (A2) — today's plan and completion state
import { getSessionDayStatus, listExercisesScheduledFor } from '@/modules/training';
// CONTRACT: CONST-NAV-001 (A1) — route builders
import { ROUTES } from '@/shared/navigation/routes';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState, ErrorBanner, LoadingView } from '@/shared/ui/feedback';
import { useFocusLoad } from '@/shared/ui/useFocusLoad';
import { useTheme } from '@/shared/ui/theme';
import { todayLocal } from '@/shared/utils/dates';
import type { Exercise, SessionDayStatus } from '@/shared/types/training';

interface TodayData {
  exercises: Exercise[];
  status: SessionDayStatus;
}

function completionLabel(status: SessionDayStatus): string {
  if (status.scheduledExerciseCount === 0) {
    return 'Nothing scheduled today';
  }
  if (status.completedSessionCount > 0) {
    return 'Done today';
  }
  if (status.stoppedSessionCount > 0) {
    return 'Stopped early';
  }
  return 'Not done yet';
}

export function TodayExerciseCard(): React.JSX.Element {
  const theme = useTheme();

  const load = useCallback(async (): Promise<TodayData> => {
    const today = todayLocal();
    const [exercises, status] = await Promise.all([
      listExercisesScheduledFor(today),
      getSessionDayStatus(today),
    ]);
    return { exercises, status };
  }, []);

  const { data, loading, error } = useFocusLoad(load, []);

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <AppText variant="heading" style={{ flex: 1, marginBottom: 0 }}>
          Today’s exercises
        </AppText>
        <AppText variant="caption" muted style={{ marginBottom: 0 }}>
          {completionLabel(data?.status ?? { localDate: '', scheduledExerciseCount: 0, completedSessionCount: 0, stoppedSessionCount: 0 })}
        </AppText>
      </View>

      <ErrorBanner error={error} />
      {loading && !data ? <LoadingView /> : null}

      {data?.exercises.length === 0 ? (
        <EmptyState
          title="No exercises scheduled today"
          message="Nothing is scheduled for today. You can still start a session with whatever is active."
          action={{ label: 'Open exercises', onPress: () => router.push(ROUTES.exercises) }}
        />
      ) : null}

      {data && data.exercises.length > 0
        ? data.exercises.map((exercise) => (
            <AppText key={exercise.id} variant="caption" muted>
              • {exercise.name} — {exercise.sets} × {exercise.reps ?? `${exercise.durationSeconds}s`}
            </AppText>
          ))
        : null}

      <View style={{ marginTop: theme.spacing.sm }}>
        <Button
          label="Start session"
          onPress={() =>
            router.push(
              ROUTES.sessionRun((data?.exercises ?? []).map((exercise) => exercise.id)),
            )
          }
          disabled={loading || (data?.exercises.length ?? 0) === 0}
        />
      </View>
    </Card>
  );
}