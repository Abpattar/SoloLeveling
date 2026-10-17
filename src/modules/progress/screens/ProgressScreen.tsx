/**
 * INTEGRATION CONTRACT: CMP-PRG-001
 * Purpose: the Progress tab — weight trend, daily calories and protein, exercise consistency and
 *          other measurements over a 7 / 30 / 90 day range. Every number comes from a stored fact;
 *          nothing on this screen interprets what the numbers mean.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CMP-PRG-001), AGENT_06_PROMPT.md §3
 * Consumers: src/app/(tabs)/progress.tsx (A7)
 * Contract status: APPROVED
 */
import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
// CONTRACT: API-BODY-004/005 (A6 self)
import { getWeightSeriesKg, listMeasurements, movingAverage } from '@/modules/body';
// CONTRACT: API-FOOD-018 (A3) — daily totals over a range
import { getNutritionTotalsForRange } from '@/modules/food';
// CONTRACT: API-TRN-015 (A2) — completed session counts per day
import { getCompletedSessionCountsByDate } from '@/modules/training';
import { exerciseConsistencyByWeek, weeklyNutritionAverages } from '../domain/trends';
// CONTRACT: LOCAL-WORKAROUND (A6) - dependency-free SVG charts, shared UI
import { BarChart } from '@/shared/ui/charts/BarChart';
import { LineChart } from '@/shared/ui/charts/LineChart';
// CONST-TEXT-004 (A1) — the fixed estimate disclaimer
import { ESTIMATE_DISCLAIMER_TEXT } from '@/shared/constants/text';
// CONTRACT: HOOK-SET-001 (A1) — optional user-set targets
import { useSettings } from '@/shared/settings/SettingsProvider';
// CONTRACT: CONST-NAV-001 (A1) — route builders
import { ROUTES } from '@/shared/navigation/routes';
import { Screen } from '@/shared/ui/Screen';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Segmented } from '@/shared/ui/Chip';
import { ErrorBanner, LoadingView } from '@/shared/ui/feedback';
import { useFocusLoad } from '@/shared/ui/useFocusLoad';
import { useTheme } from '@/shared/ui/theme';
import { addDays, formatDisplayDate, todayLocal } from '@/shared/utils/dates';
import type { LocalDate } from '@/shared/types/common';
import type { DailyNutritionTotals } from '@/shared/types/food';
import type { Measurement, WeightPoint } from '@/shared/types/body';

type RangeDays = 7 | 30 | 90;

interface ProgressData {
  weightSeries: WeightPoint[];
  nutrition: DailyNutritionTotals[];
  completedByDate: Record<LocalDate, number>;
  measurements: Measurement[];
}

export function ProgressScreen(): React.JSX.Element {
  const theme = useTheme();
  const { settings } = useSettings();
  const [rangeDays, setRangeDays] = useState<RangeDays>(30);

  const to = todayLocal();
  const from = addDays(to, -(rangeDays - 1));

  const load = useCallback(async (): Promise<ProgressData> => {
    const [weightSeries, nutrition, completedByDate, measurements] = await Promise.all([
      getWeightSeriesKg({ from, to }),
      getNutritionTotalsForRange(from, to),
      getCompletedSessionCountsByDate(from, to),
      listMeasurements({ from, to }),
    ]);
    return { weightSeries, nutrition, completedByDate, measurements };
  }, [from, to]);

  const { data, loading, error } = useFocusLoad(load, [rangeDays]);

  const average = useMemo(() => movingAverage(data?.weightSeries ?? [], 7), [data]);
  const weeklyNutrition = useMemo(() => weeklyNutritionAverages(data?.nutrition ?? []), [data]);
  const consistency = useMemo(
    () => exerciseConsistencyByWeek(data?.completedByDate ?? {}, from, to),
    [data, from, to],
  );
  const otherMeasurements = (data?.measurements ?? []).filter((m) => m.type !== 'weight');

  const referenceLines =
    settings.nutrition.targetCaloriesKcal !== null
      ? [{ label: 'your calorie target', value: settings.nutrition.targetCaloriesKcal }]
      : [];

  return (
    <Screen>
      <AppText variant="title">Progress</AppText>
      <AppText muted>Recorded data and simple trends. This app does not interpret them.</AppText>

      <Segmented
        options={[
          { value: '7', label: '7 days' },
          { value: '30', label: '30 days' },
          { value: '90', label: '90 days' },
        ]}
        value={String(rangeDays)}
        onChange={(value) => setRangeDays(Number(value) as RangeDays)}
      />

      <ErrorBanner error={error} />
      {loading && !data ? <LoadingView /> : null}

      <Card>
        <LineChart
          title="Weight trend (kg)"
          points={(data?.weightSeries ?? []).map((point) => ({
            label: formatDisplayDate(point.localDate),
            value: point.valueKg,
          }))}
          averagePoints={average.map((point) => ({
            label: formatDisplayDate(point.localDate),
            value: point.valueKg,
          }))}
          unit="kg"
        />
        <AppText variant="caption" muted>
          The dashed line is the 7-day average. Day-to-day changes are normal.
        </AppText>
      </Card>

      <Card>
        <BarChart
          title="Daily calories"
          points={(data?.nutrition ?? []).map((day) => ({
            label: formatDisplayDate(day.localDate),
            value: day.total.caloriesKcal,
          }))}
          referenceLines={referenceLines}
          unit="kcal"
        />
        <AppText variant="caption" muted>
          {ESTIMATE_DISCLAIMER_TEXT}
        </AppText>
        {weeklyNutrition.map((week) => (
          <AppText key={week.key} variant="caption" muted>
            {`${week.key}: about ${Math.round(week.averageCaloriesKcal)} kcal over ${
              week.daysCounted
            } day${week.daysCounted === 1 ? '' : 's'}`}
          </AppText>
        ))}
      </Card>

      <Card>
        <BarChart
          title="Daily protein (g)"
          points={(data?.nutrition ?? []).map((day) => ({
            label: formatDisplayDate(day.localDate),
            value: day.total.proteinGrams,
          }))}
          unit="g"
        />
      </Card>

      <Card>
        <BarChart
          title="Completed sessions per week"
          points={consistency.map((week) => ({
            label: week.key,
            value: week.completedSessions,
          }))}
          unit="sessions"
        />
        {consistency.length === 0 ? (
          <AppText variant="caption" muted>
            No completed sessions in this range.
          </AppText>
        ) : null}
      </Card>

      <Card>
        <AppText variant="heading" style={{ marginBottom: 0 }}>
          Other measurements
        </AppText>
        {otherMeasurements.length === 0 ? (
          <AppText variant="caption" muted>
            None in this range.
          </AppText>
        ) : (
          otherMeasurements.map((measurement) => (
            <AppText key={measurement.id} variant="caption" muted>
              {`${
                measurement.type === 'custom' ? (measurement.customLabel ?? 'other') : measurement.type
              }: ${measurement.value} ${measurement.unit} on ${formatDisplayDate(measurement.localDate)}`}
            </AppText>
          ))
        )}
      </Card>

      <View style={{ gap: theme.spacing.sm }}>
        <Button
          label="Measurements"
          variant="secondary"
          onPress={() => router.push(ROUTES.measurements)}
        />
        <Button label="Journal" variant="secondary" onPress={() => router.push(ROUTES.journal)} />
        <Button
          label="Session history"
          variant="secondary"
          onPress={() => router.push(ROUTES.sessionHistory)}
        />
        <Button
          label="Today's summary"
          variant="secondary"
          onPress={() => router.push(ROUTES.dailySummary(todayLocal()))}
        />
      </View>
    </Screen>
  );
}