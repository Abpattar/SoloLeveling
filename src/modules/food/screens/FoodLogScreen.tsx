/**
 * INTEGRATION CONTRACT: CMP-FOOD-001
 * Purpose: the Food tab — a day navigator, the day's totals, meals grouped by category, and the
 *          camera button. It never asks the user to search a food database (REQ-FOOD-005) and never
 *          recommends a target (REQ-NUT-004).
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CMP-FOOD-001), REQ-FOOD-001/005/007
 * Consumers: src/app/(tabs)/food.tsx (A7)
 * Contract status: APPROVED
 */
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
// CONTRACT: API-FOOD-008/017, API-FOOD-001 (A3 self)
import {
  getDailyNutritionTotals,
  isAnalysisWired,
  listFoodEntriesForDate,
  listMealCategories,
  processPendingAnalyses,
} from '@/modules/food';
// CONTRACT: HOOK-SET-001 (A1) — optional user-set targets
import { useSettings } from '@/shared/settings/SettingsProvider';
// CONTRACT: CONST-TEXT-004 (A1) — the fixed estimate disclaimer
import { ESTIMATE_DISCLAIMER_TEXT } from '@/shared/constants/text';
// CONTRACT: CONST-NAV-001 (A1) — route builders
import { ROUTES } from '@/shared/navigation/routes';
import { Screen } from '@/shared/ui/Screen';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState, ErrorBanner, LoadingView } from '@/shared/ui/feedback';
import { useFocusLoad } from '@/shared/ui/useFocusLoad';
import { useTheme } from '@/shared/ui/theme';
import { addDays, formatDisplayDate, todayLocal } from '@/shared/utils/dates';
import { EntryCard, formatGrams, formatKcal } from '@/modules/food/components/EntryCard';
import type { DailyNutritionTotals, FoodEntry, MealCategory } from '@/shared/types/food';
import type { LocalDate } from '@/shared/types/common';

interface DayData {
  totals: DailyNutritionTotals;
  entries: FoodEntry[];
  categories: MealCategory[];
  pendingCount: number;
}

export function FoodLogScreen(): React.JSX.Element {
  const theme = useTheme();
  const { settings } = useSettings();
  const [date, setDate] = useState<LocalDate>(todayLocal());

  const load = useCallback(async (): Promise<DayData> => {
    const [totals, entries, categories] = await Promise.all([
      getDailyNutritionTotals(date),
      listFoodEntriesForDate(date),
      listMealCategories(),
    ]);
    return {
      totals,
      entries,
      categories,
      pendingCount: entries.filter((e) => e.analysisStatus === 'pending').length,
    };
  }, [date]);

  const { data, loading, error, reload } = useFocusLoad(load, [date]);

  const today = todayLocal();
  const targets = settings.nutrition;
  const analysisReady = isAnalysisWired();

  return (
    <Screen>
      <AppText variant="title">Food</AppText>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Button label="Previous day" variant="ghost" onPress={() => setDate(addDays(date, -1))} />
        <AppText variant="heading" style={{ flex: 1, textAlign: 'center', marginBottom: 0 }}>
          {date === today ? 'Today' : formatDisplayDate(date)}
        </AppText>
        <Button
          label="Next day"
          variant="ghost"
          onPress={() => setDate(addDays(date, 1))}
          disabled={date >= today}
        />
      </View>
      <Button label="Jump to today" variant="ghost" onPress={() => setDate(today)} disabled={date === today} />

      <ErrorBanner error={error} />
      {loading && !data ? <LoadingView /> : null}

      <Card>
        <AppText variant="heading" style={{ marginBottom: 0 }}>
          {data ? formatKcal(data.totals.total.caloriesKcal) : '—'}
        </AppText>
        <AppText variant="caption" muted>
          {data ? formatGrams(data.totals.total.proteinGrams, 'Protein') : ''}
        </AppText>
        {data && data.totals.total.carbsGrams !== null ? (
          <AppText variant="caption" muted>
            {formatGrams(data.totals.total.carbsGrams, 'Carbs')} ·{' '}
            {formatGrams(data.totals.total.fatGrams, 'Fat')}
          </AppText>
        ) : null}
        {targets.targetCaloriesKcal !== null ? (
          <AppText variant="caption" muted>
            {Math.round(data?.totals.total.caloriesKcal ?? 0)} of {targets.targetCaloriesKcal} kcal
            {targets.targetProteinGrams !== null
              ? ` · ${Math.round(data?.totals.total.proteinGrams ?? 0)} of ${targets.targetProteinGrams} g protein`
              : ''}
          </AppText>
        ) : null}
        {data && data.totals.entriesWithoutValues > 0 ? (
          <AppText variant="caption" muted>
            {data.totals.entriesWithoutValues} meal photo
            {data.totals.entriesWithoutValues === 1 ? '' : 's'} without values yet
          </AppText>
        ) : null}
        <AppText variant="caption" muted>
          {ESTIMATE_DISCLAIMER_TEXT}
        </AppText>
      </Card>

      <Button label="Log food" onPress={() => router.push(ROUTES.foodCapture())} />

      {data && data.pendingCount > 0 ? (
        <View>
          <Button
            label={`Analyze pending (${data.pendingCount})`}
            variant="secondary"
            onPress={() => void processPendingAnalyses().then(reload)}
            disabled={!analysisReady}
          />
          {!analysisReady ? (
            <AppText variant="caption" muted>
              {settings.ai.externalAnalysisEnabled
                ? 'Add your provider key in Settings first.'
                : 'Turn on food photo analysis in Settings to analyze these.'}
            </AppText>
          ) : null}
        </View>
      ) : null}

      {settings.ai.externalAnalysisEnabled ? null : (
        <AppText variant="caption" muted>
          Photos are saved on this phone. Turn on food photo analysis in Settings if you want an
          estimate, or add the values yourself.
        </AppText>
      )}

      <Button label="Manage meals" variant="ghost" onPress={() => router.push(ROUTES.mealCategories)} />

      {!loading && (data?.entries.length ?? 0) === 0 ? (
        <EmptyState
          title="Nothing logged for this day"
          message="Take a photo of a meal to add it. Searching a food list is not needed."
          action={{ label: 'Log food', onPress: () => router.push(ROUTES.foodCapture()) }}
        />
      ) : null}

      {data?.categories.map((category) => {
        const entries = data.entries.filter((entry) => entry.mealCategoryId === category.id);
        const subtotal = data.totals.mealSubtotals.find((s) => s.mealCategoryId === category.id);
        return (
          <View key={category.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AppText variant="heading" style={{ flex: 1, marginBottom: 0 }}>
                {category.name}
              </AppText>
              <Button
                label="Log food"
                variant="ghost"
                onPress={() => router.push(ROUTES.foodCapture(category.id))}
              />
            </View>
            {entries.length === 0 ? (
              <AppText variant="caption" muted>
                Nothing yet.
              </AppText>
            ) : (
              entries.map((entry) => (
                <EntryCard key={entry.id} entry={entry} category={category} />
              ))
            )}
            {subtotal ? (
              <AppText variant="caption" muted>
                {formatKcal(subtotal.total.caloriesKcal)} ·{' '}
                {formatGrams(subtotal.total.proteinGrams, 'Protein')}
              </AppText>
            ) : null}
          </View>
        );
      })}
    </Screen>
  );
}