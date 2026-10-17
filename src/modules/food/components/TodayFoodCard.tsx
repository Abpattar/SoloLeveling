/**
 * INTEGRATION CONTRACT: CMP-FOOD-005
 * Purpose: the Today card for food — today's rough calories and protein, how many photos were
 *          logged, and the button that opens the camera. Read-only.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CMP-FOOD-005), REQ-FOOD-007
 * Consumers: src/shell/TodayScreen.tsx (A7)
 * Contract status: APPROVED
 */
import React, { useCallback } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
// CONTRACT: API-FOOD-008/017 (A3 self)
import { getDailyNutritionTotals, listFoodEntriesForDate } from '@/modules/food';
// CONTRACT: CONST-NAV-001 (A1) — route builders
import { ROUTES } from '@/shared/navigation/routes';
import { Card } from '@/shared/ui/Card';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { ErrorBanner, LoadingView } from '@/shared/ui/feedback';
import { useFocusLoad } from '@/shared/ui/useFocusLoad';
import { useTheme } from '@/shared/ui/theme';
import { todayLocal } from '@/shared/utils/dates';
import { formatGrams, formatKcal } from './EntryCard';
import type { DailyNutritionTotals, FoodEntry } from '@/shared/types/food';

interface TodayFoodData {
  totals: DailyNutritionTotals;
  entries: FoodEntry[];
}

export function TodayFoodCard(): React.JSX.Element {
  const theme = useTheme();

  const load = useCallback(async (): Promise<TodayFoodData> => {
    const today = todayLocal();
    const [totals, entries] = await Promise.all([
      getDailyNutritionTotals(today),
      listFoodEntriesForDate(today),
    ]);
    return { totals, entries };
  }, []);

  const { data, loading, error } = useFocusLoad(load, []);

  return (
    <Card>
      <AppText variant="heading" style={{ marginBottom: 0 }}>
        Today&rsquo;s food
      </AppText>
      <ErrorBanner error={error} />
      {loading && !data ? <LoadingView /> : null}

      {data ? (
        <>
          <AppText variant="caption" muted>
            {data.entries.length === 0
              ? 'Nothing logged yet.'
              : `${data.entries.length} meal photo${data.entries.length === 1 ? '' : 's'} logged`}
          </AppText>
          <AppText variant="caption" muted>
            {formatKcal(data.totals.total.caloriesKcal)} ·{' '}
            {formatGrams(data.totals.total.proteinGrams, 'Protein')}
          </AppText>
        </>
      ) : null}

      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Button label="Log food" onPress={() => router.push(ROUTES.foodCapture())} />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label="Open food log"
            variant="secondary"
            onPress={() => router.push(ROUTES.food)}
          />
        </View>
      </View>
    </Card>
  );
}