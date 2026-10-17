// CONTRACT: CMP-PRG-002 (A6) — a malformed date is shown, never guessed at
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { DailySummaryScreen } from '@/modules/progress';
import { EmptyState } from '@/shared/ui/feedback';
import { isValidLocalDate } from '@/shared/utils/dates';

export default function DailySummaryRoute(): React.JSX.Element {
  const { date } = useLocalSearchParams<{ date: string }>();

  if (!isValidLocalDate(date)) {
    return <EmptyState title="That date could not be read" message="Open the summary from Today." />;
  }

  return <DailySummaryScreen date={date} />;
}
