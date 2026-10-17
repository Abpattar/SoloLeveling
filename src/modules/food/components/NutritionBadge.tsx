/**
 * INTEGRATION CONTRACT: internal component (A3 food)
 * Purpose: the source badge for a meal's nutrition. The wording is deliberately narrow so nothing in
 *          the UI can imply the numbers are exact (SAF-05, GAT-014).
 * Canonical definition: AGENT_03_PROMPT.md §3, GLOBAL_ACCEPTANCE_TESTS GAT-014
 * Consumers: EntryCard.tsx, FoodEntryScreen.tsx
 * Contract status: APPROVED (internal symbol, no registry ID)
 */
import React from 'react';
import { AppText } from '@/shared/ui/AppText';
import { useTheme } from '@/shared/ui/theme';
import type { NutritionSource } from '@/shared/types/food';

const LABELS: Record<NutritionSource, string | null> = {
  ai_estimate: 'AI estimate',
  confirmed: 'Confirmed',
  manual: 'Manual',
  unknown: 'Unknown',
  none: null,
};

export interface NutritionBadgeProps {
  source: NutritionSource;
}

export function labelForSource(source: NutritionSource): string | null {
  return LABELS[source] ?? null;
}

export function NutritionBadge({ source }: NutritionBadgeProps): React.JSX.Element | null {
  const theme = useTheme();
  const label = labelForSource(source);
  if (label === null) {
    return null;
  }
  const color =
    source === 'ai_estimate'
      ? theme.colors.warning
      : source === 'confirmed'
        ? theme.colors.success
        : theme.colors.textMuted;
  return (
    <AppText variant="caption" style={{ color, marginBottom: 0 }}>
      {label}
    </AppText>
  );
}