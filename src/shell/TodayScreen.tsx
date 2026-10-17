/**
 * INTEGRATION CONTRACT: CMP-SHELL-002
 * Purpose: the Today tab. Header, the three read-only module cards, and the two ways out
 *          (today's summary and settings). This screen owns no data of its own beyond the header.
 * Canonical definition: SHARED_CONTRACT.md §5, SHARED_SYMBOL_REGISTRY.md (CMP-SHELL-002)
 * Consumers: src/app/(tabs)/index.tsx
 * Contract status: APPROVED
 */
import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
// CONTRACT: HOOK-PHOTO-001 (A5) - active journey and today's day number
// CONTRACT: CMP-PHOTO-006 (A5) - the milestone card
import { TodayMilestoneCard, useActiveJourney } from '@/modules/photos';
// CONTRACT: CMP-TRN-007 (A2) - today's plan
import { TodayExerciseCard } from '@/modules/training';
// CONTRACT: CMP-FOOD-005 (A3) - today's food
import { TodayFoodCard } from '@/modules/food';
// CONTRACT: CONST-NAV-001 (A1) - route builders
import { ROUTES } from '@/shared/navigation/routes';
// CONTRACT: CMP-UI-001..004 (A1) - screen chrome and buttons
import { Screen } from '@/shared/ui/Screen';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
// CONTRACT: API-DATE-002/011 (A1) - local dates
import { formatDisplayDate, todayLocal } from '@/shared/utils/dates';
import { useTheme } from '@/shared/ui/theme';

export function TodayScreen(): React.JSX.Element {
  const theme = useTheme();
  const { dayNumber } = useActiveJourney();
  const today = todayLocal();

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <AppText variant="title" style={{ flex: 1 }}>
          {dayNumber === null ? 'Today' : `Day ${dayNumber}`}
        </AppText>
        <Button
          label="Settings"
          variant="ghost"
          onPress={() => router.push(ROUTES.settings)}
        />
      </View>
      <AppText variant="caption" muted>
        {formatDisplayDate(today)}
      </AppText>

      <TodayExerciseCard />
      <TodayFoodCard />
      <TodayMilestoneCard />

      <View style={{ marginTop: theme.spacing.sm }}>
        <Button
          label="Today's summary"
          variant="secondary"
          onPress={() => router.push(ROUTES.dailySummary(today))}
        />
      </View>
    </Screen>
  );
}
