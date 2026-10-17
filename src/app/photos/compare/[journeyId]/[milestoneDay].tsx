// CONTRACT: CMP-PHOTO-003 (A5) — only 30/60/90 exist; anything else is shown as invalid
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { MILESTONE_DAYS, PhotoComparisonScreen } from '@/modules/photos';
import { EmptyState } from '@/shared/ui/feedback';
import type { MilestoneDay } from '@/shared/types/photos';

export default function PhotoCompareRoute(): React.JSX.Element {
  const { journeyId, milestoneDay } = useLocalSearchParams<{ journeyId: string; milestoneDay: string }>();
  const parsed = Number(milestoneDay);
  if (!MILESTONE_DAYS.includes(parsed as MilestoneDay)) {
    return <EmptyState title="That milestone does not exist" message="Milestones are Day 30, 60 and 90." />;
  }
  return <PhotoComparisonScreen journeyId={journeyId} milestoneDay={parsed as MilestoneDay} />;
}
