/**
 * INTEGRATION CONTRACT: CMP-TRN-006
 * Purpose: one past session in full, with the reflection and a delete action. The safety card is
 *          re-derived from the stored flags and pain score, so it still shows on a later read.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CMP-TRN-006), GAT-009
 * Consumers: src/app/session/[sessionId].tsx (A7)
 * Contract status: APPROVED
 */
import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
// CONTRACT: API-TRN-009/013 (A2) — load and delete
import { deleteSession, getSession } from '@/modules/training';
// CONTRACT: API-SAFE-001 (A1) — advice decision
import { evaluateSymptomReport } from '@/shared/domain/safety';
// CONTRACT: HOOK-SET-001 (A1) — display toggle and alert level
import { useSettings } from '@/shared/settings/SettingsProvider';
// CONTRACT: CONST-TEXT-006 (A1) — fixed workout-calorie label
import { WORKOUT_KCAL_LABEL } from '@/shared/constants/text';
// CONTRACT: CMP-SAFE-002 (A1) — advice card
import { SafetyAdviceCard } from '@/shared/ui/safetyUi';
import { ROUTES } from '@/shared/navigation/routes';
import { confirmAction } from '@/shared/ui/confirmAction';
import { Screen } from '@/shared/ui/Screen';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState, ErrorBanner, LoadingView } from '@/shared/ui/feedback';
import { useFocusLoad } from '@/shared/ui/useFocusLoad';
import { useTheme } from '@/shared/ui/theme';
import { formatDisplayDate } from '@/shared/utils/dates';
import { toAppError } from '@/shared/errors/AppError';
import type { Session } from '@/shared/types/training';

export interface SessionDetailScreenProps {
  sessionId: string;
}

export function SessionDetailScreen({ sessionId }: SessionDetailScreenProps): React.JSX.Element {
  const theme = useTheme();
  const { settings } = useSettings();
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<Session> => getSession(sessionId), [sessionId]);
  const { data: session, loading, error, reload } = useFocusLoad(load, [sessionId]);

  const advice = useMemo(() => {
    if (!session) {
      return null;
    }
    return evaluateSymptomReport(
      { flags: session.symptomFlags, painScore: session.painScore },
      settings.safety.painAlertLevel,
    );
  }, [session, settings.safety.painAlertLevel]);

  const remove = async (): Promise<void> => {
    const ok = await confirmAction({
      title: 'Delete this session?',
      message: 'This removes the record permanently. Your exercises are not affected.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) {
      return;
    }
    setDeleting(true);
    setActionError(null);
    try {
      await deleteSession(sessionId);
      router.replace(ROUTES.sessionHistory);
    } catch (e) {
      setActionError(toAppError(e).message);
    } finally {
      setDeleting(false);
    }
  };

  if (loading && !session) {
    return (
      <Screen>
        <LoadingView />
      </Screen>
    );
  }

  if (!session) {
    return (
      <Screen>
        <ErrorBanner error={error} />
        <EmptyState
          title="Session not found"
          message="It may have been deleted."
          action={{ label: 'Back to history', onPress: () => router.replace(ROUTES.sessionHistory) }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppText variant="title">{formatDisplayDate(session.localDate)}</AppText>
      <ErrorBanner error={error ?? actionError} />

      <Card>
        <AppText variant="heading" style={{ marginBottom: 0 }}>
          {session.status === 'completed' ? 'Completed' : 'Stopped early'} ·{' '}
          {Math.round(session.totalDurationSeconds / 60)} min
        </AppText>
        {session.effortRating !== null ? (
          <AppText variant="caption" muted>
            Effort {session.effortRating}/10
          </AppText>
        ) : null}
        {session.painScore !== null ? (
          <AppText variant="caption" muted>
            Pain {session.painScore}/10
          </AppText>
        ) : null}
        {settings.display.showCalorieEstimates && session.estimatedKcal !== null ? (
          <AppText variant="caption" muted>
            {WORKOUT_KCAL_LABEL}: ≈ {session.estimatedKcal} kcal
          </AppText>
        ) : null}
      </Card>

      {session.results.map((result) => (
        <Card key={result.id}>
          <AppText variant="heading" style={{ marginBottom: 0 }}>
            {result.exerciseName}
          </AppText>
          <AppText variant="caption" muted>
            {result.completedSets}/{result.plannedSets} sets
            {result.completedReps !== null ? ` · ${result.completedReps} reps` : ''}
            {` · ${result.activeSeconds}s active`}
          </AppText>
          {result.status !== 'completed' ? (
            <AppText variant="caption" muted>
              {result.status === 'partial' ? 'Partly done' : 'Skipped'}
            </AppText>
          ) : null}
        </Card>
      ))}

      {advice ? <SafetyAdviceCard advice={advice} /> : null}

      {session.notes ? (
        <Card>
          <AppText variant="heading" style={{ marginBottom: 0 }}>
            Notes
          </AppText>
          <AppText>{session.notes}</AppText>
        </Card>
      ) : null}

      <Button label="Delete session" variant="danger" onPress={() => void remove()} loading={deleting} />
      <View style={{ height: theme.spacing.md }} />
      <Button label="Reload" variant="ghost" onPress={reload} />
    </Screen>
  );
}