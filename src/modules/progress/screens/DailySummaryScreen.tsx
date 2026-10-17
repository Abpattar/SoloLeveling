/**
 * INTEGRATION CONTRACT: internal screen (A6 progress)
 * Purpose: one day's recorded totals. Workout calories sit on their own line and are never added to
 *          food intake (SAF-07, GAT-030). Nothing here is described as a result or an outcome.
 * Canonical definition: AGENT_06_PROMPT.md §3 (`progress/screens/DailySummaryScreen.tsx`)
 * Consumers: src/app/progress/[date].tsx (A7)
 * Contract status: APPROVED
 */
import React, { useCallback } from 'react';
import { router } from 'expo-router';
// CONTRACT: API-PRG-001 (A6 self)
import { getDailySummary } from '../services/dailySummary';
// CONST-TEXT-004 (A1) — the fixed estimate disclaimer
import { ESTIMATE_DISCLAIMER_TEXT } from '@/shared/constants/text';
// CONTRACT: CONST-NAV-001 (A1) — route builder
import { ROUTES } from '@/shared/navigation/routes';
import { Screen } from '@/shared/ui/Screen';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState, ErrorBanner, LoadingView } from '@/shared/ui/feedback';
import { useFocusLoad } from '@/shared/ui/useFocusLoad';
import { formatDisplayDate } from '@/shared/utils/dates';
import type { DailySummary } from '@/shared/types/summary';
import type { LocalDate } from '@/shared/types/common';

export interface DailySummaryScreenProps {
  date: LocalDate;
}

export function DailySummaryScreen({ date }: DailySummaryScreenProps): React.JSX.Element {
  const load = useCallback(async (): Promise<DailySummary> => getDailySummary(date), [date]);
  const { data, loading, error } = useFocusLoad(load, [date]);

  if (loading && !data) {
    return (
      <Screen>
        <LoadingView />
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen>
        <ErrorBanner error={error} />
        <EmptyState
          title="Nothing to show"
          message="This day has no recorded data."
          action={{ label: 'Back to progress', onPress: () => router.back() }}
        />
      </Screen>
    );
  }

  const { nutrition, targets, sessions, scheduledExerciseCount } = data;
  const completed = sessions.filter((session) => session.status === 'completed');

  return (
    <Screen>
      <AppText variant="title">{formatDisplayDate(date)}</AppText>
      <AppText muted>What you recorded. No interpretation.</AppText>
      <ErrorBanner error={error} />

      <Card>
        <AppText variant="heading" style={{ marginBottom: 0 }}>
          Food
        </AppText>
        <AppText variant="caption" muted>
          {`${Math.round(nutrition.total.caloriesKcal)} kcal · protein ${
            nutrition.total.proteinGrams.toFixed(0)
          } g · carbs ${(nutrition.total.carbsGrams ?? 0).toFixed(0)} g · fat ${(
            nutrition.total.fatGrams ?? 0
          ).toFixed(0)} g`}
        </AppText>
        {targets.caloriesKcal !== null || targets.proteinGrams !== null ? (
          <AppText variant="caption" muted>
            {[
              targets.caloriesKcal !== null ? `calorie target ${targets.caloriesKcal} kcal` : null,
              targets.proteinGrams !== null ? `protein target ${targets.proteinGrams} g` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </AppText>
        ) : null}
        <AppText variant="caption" muted>
          {ESTIMATE_DISCLAIMER_TEXT}
        </AppText>
      </Card>

      <Card>
        <AppText variant="heading" style={{ marginBottom: 0 }}>
          Exercise
        </AppText>
        <AppText variant="caption" muted>
          {`${scheduledExerciseCount} scheduled · ${completed.length} completed of ${sessions.length} started`}
        </AppText>
        <AppText variant="caption" muted>
          {data.estimatedWorkoutKcal === null
            ? 'No workout calorie figure recorded.'
            : `Workout calories: about ${Math.round(
                data.estimatedWorkoutKcal,
              )} kcal (rough estimate).`}
        </AppText>
        <AppText variant="caption" muted>
          Workout calories stay separate from food calories. They are not added together.
        </AppText>
      </Card>

      <Card>
        <AppText variant="heading" style={{ marginBottom: 0 }}>
          Weight
        </AppText>
        <AppText variant="caption" muted>
          {data.weightKg === null
            ? 'No weight recorded for this day.'
            : `${data.weightKg.toFixed(1)} kg`}
        </AppText>
      </Card>

      <Card>
        <AppText variant="heading" style={{ marginBottom: 0 }}>
          Other measurements
        </AppText>
        {data.measurements.filter((m) => m.type !== 'weight').length === 0 ? (
          <AppText variant="caption" muted>
            None recorded for this day.
          </AppText>
        ) : (
          data.measurements
            .filter((m) => m.type !== 'weight')
            .map((m) => (
              <AppText key={m.id} variant="caption" muted>
                {`${m.type === 'custom' ? (m.customLabel ?? 'other') : m.type}: ${m.value} ${m.unit}`}
              </AppText>
            ))
        )}
      </Card>

      <Card>
        <AppText variant="heading" style={{ marginBottom: 0 }}>
          Journal
        </AppText>
        {data.journalEntries.length === 0 ? (
          <AppText variant="caption" muted>
            No journal entry for this day.
          </AppText>
        ) : (
          data.journalEntries.map((entry) => (
            <AppText key={entry.id} variant="caption" muted>
              {`Entry recorded${
                entry.painScore === null ? '' : ` · pain ${entry.painScore}/10`
              }${entry.stiffnessScore === null ? '' : ` · stiffness ${entry.stiffnessScore}/10`}`}
            </AppText>
          ))
        )}
      </Card>

      <Button label="Back to progress" variant="ghost" onPress={() => router.push(ROUTES.progress)} />
    </Screen>
  );
}