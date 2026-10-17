/**
 * INTEGRATION CONTRACT: CMP-PHOTO-006
 * Purpose: the Today milestone card. Read-only, and deliberately vague about locked photos — it
 *          says how many are hidden, never what they are.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CMP-PHOTO-006)
 * Consumers: src/shell/TodayScreen.tsx (A7)
 * Contract status: APPROVED
 */
import React, { useCallback } from 'react';
import { router } from 'expo-router';
// API-PHOTO-001/008 (A5 self)
import {
  getActiveJourney,
  getMilestoneStates,
  getMilestoneUnlockDate,
  getNextPendingMilestone,
  loadEarlyUnlockedDays,
} from '@/modules/photos';
// HOOK-PHOTO-001 (A5 self)
import { useActiveJourney } from '@/modules/photos/hooks/useActiveJourney';
// CONTRACT: CONST-NAV-001 (A1) — route builders
import { ROUTES } from '@/shared/navigation/routes';
import { Card } from '@/shared/ui/Card';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { useFocusLoad } from '@/shared/ui/useFocusLoad';
import { formatDisplayDate, todayLocal } from '@/shared/utils/dates';
import type { MilestoneDay, MilestoneState } from '@/shared/types/photos';

export function TodayMilestoneCard(): React.JSX.Element | null {
  const { journey, dayNumber } = useActiveJourney();

  const load = useCallback(async (): Promise<{
    activeId: string;
    states: MilestoneState[];
    earlyUnlockedDays: MilestoneDay[];
  } | null> => {
    const active = await getActiveJourney();
    if (active === null) {
      return null;
    }
    const [states, earlyUnlockedDays] = await Promise.all([
      getMilestoneStates(active.id),
      loadEarlyUnlockedDays(active.id),
    ]);
    return { activeId: active.id, states, earlyUnlockedDays };
  }, []);

  const { data } = useFocusLoad(load, [journey?.id]);

  if (!journey || data === null || data === undefined) {
    return null;
  }

  const next = getNextPendingMilestone({
    startDate: journey.startDate,
    today: todayLocal(),
    earlyUnlockedDays: data.earlyUnlockedDays,
  });

  if (next === null) {
    const allUnlocked = (dayNumber ?? 1) > 90;
    return (
      <Card>
        <AppText variant="heading" style={{ marginBottom: 0 }}>
          Progress photos
        </AppText>
        <AppText variant="caption" muted>
          {allUnlocked
            ? `Journey ${journey.number} is complete — start Journey ${journey.number + 1} from the Photos tab when you are ready.`
            : 'All milestones unlocked.'}
        </AppText>
        <Button label="Open photos" variant="ghost" onPress={() => router.push(ROUTES.photos)} />
      </Card>
    );
  }

  const unlockDate = getMilestoneUnlockDate(journey.startDate, next);
  const lockedCount = data.states.find((s) => s.day === next)?.lockedPhotoCount ?? 0;

  return (
    <Card>
      <AppText variant="heading" style={{ marginBottom: 0 }}>
        {`Day ${dayNumber ?? 1} of 90`}
      </AppText>
      <AppText variant="caption" muted>
        {`Day ${next} unlocks ${formatDisplayDate(unlockDate)}`}
      </AppText>
      {lockedCount > 0 ? (
        <AppText variant="caption" muted>
          {`${lockedCount} photo${lockedCount === 1 ? '' : 's'} hidden until then`}
        </AppText>
      ) : null}
      <Button label="Open photos" variant="ghost" onPress={() => router.push(ROUTES.photos)} />
    </Card>
  );
}