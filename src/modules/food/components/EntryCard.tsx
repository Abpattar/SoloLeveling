/**
 * INTEGRATION CONTRACT: internal component (A3 food)
 * Purpose: one meal row in the food log: thumbnail, meal, time, values and source badge.
 * Canonical definition: AGENT_03_PROMPT.md §3
 * Consumers: FoodLogScreen.tsx
 * Contract status: APPROVED (internal symbol, no registry ID)
 */
import React from 'react';
import { Image, View } from 'react-native';
import { router } from 'expo-router';
// CONTRACT: CONST-NAV-001 (A1) — route builder
import { ROUTES } from '@/shared/navigation/routes';
// CONTRACT: API-FILE-002 (A1) — private photo URI resolution
import { resolvePhotoUri } from '@/shared/files/photoStorage';
import { AppText } from '@/shared/ui/AppText';
import { Card } from '@/shared/ui/Card';
import { useTheme } from '@/shared/ui/theme';
import { NutritionBadge } from './NutritionBadge';
import type { FoodEntry, MealCategory } from '@/shared/types/food';

export interface EntryCardProps {
  entry: FoodEntry;
  category: MealCategory | null;
}

export function formatKcal(value: number | null): string {
  return value === null ? 'Unknown' : `≈ ${Math.round(value)} kcal`;
}

export function formatGrams(value: number | null, label: string): string {
  return value === null ? `${label}: unknown` : `${label}: ≈ ${value.toFixed(1)} g`;
}

export function EntryCard({ entry, category }: EntryCardProps): React.JSX.Element {
  const theme = useTheme();
  const time = entry.capturedAt.slice(11, 16);
  return (
    <Card onPress={() => router.push(ROUTES.foodEntry(entry.id))}>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <Image
          source={{ uri: resolvePhotoUri(entry.imagePath) }}
          style={{ width: 56, height: 56, borderRadius: theme.radius.sm }}
          accessibilityLabel={`Photo of your ${category?.name ?? 'meal'}`}
        />
        <View style={{ flex: 1 }}>
          <AppText variant="heading" style={{ marginBottom: 0 }}>
            {category?.name ?? 'Meal'}
          </AppText>
          <AppText variant="caption" muted>
            {time} · {formatKcal(entry.nutrition.caloriesKcal)} ·{' '}
            {formatGrams(entry.nutrition.proteinGrams, 'Protein')}
          </AppText>
          {entry.description ? (
            <AppText variant="caption" muted>
              {entry.description}
            </AppText>
          ) : null}
          <NutritionBadge source={entry.nutritionSource} />
        </View>
      </View>
    </Card>
  );
}