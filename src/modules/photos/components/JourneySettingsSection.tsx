/**
 * INTEGRATION CONTRACT: CMP-PHOTO-008
 * Purpose: the Settings block for Day 1. Changing the start date recalculates every day number and
 *          unlock date, so the screen always warns first and says early unlocks are kept.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CMP-PHOTO-008), GAT-025
 * Consumers: src/shell/SettingsScreen.tsx (A7)
 * Contract status: APPROVED
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
// API-PHOTO-004 + HOOK-PHOTO-001 (A5 self)
import { updateJourneyStartDate, useActiveJourney } from '@/modules/photos';
// CONTRACT: API-UI-001 (A1) — confirmation before a recalculation
import { confirmAction } from '@/shared/ui/confirmAction';
// CONST-TEXT-005 (A1) — the fixed "motivation, not encryption" note
import { LOCK_NOTE_TEXT } from '@/shared/constants/text';
// CONTRACT: CONST-NAV-001 (A1) — route builders
import { ROUTES } from '@/shared/navigation/routes';
import { Card } from '@/shared/ui/Card';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { DateField } from '@/shared/ui/fields';
import { ErrorBanner } from '@/shared/ui/feedback';
import { useTheme } from '@/shared/ui/theme';
import { toAppError } from '@/shared/errors/AppError';
import { formatDisplayDate, todayLocal } from '@/shared/utils/dates';
import type { LocalDate } from '@/shared/types/common';

export function JourneySettingsSection(): React.JSX.Element {
  const theme = useTheme();
  const { journey, reload } = useActiveJourney();
  const [date, setDate] = useState<LocalDate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!journey) {
    return (
      <Card>
        <AppText variant="heading" style={{ marginBottom: 0 }}>
          Day 1 start date
        </AppText>
        <AppText variant="caption" muted>
          No journey yet.
        </AppText>
      </Card>
    );
  }

  const current = date ?? journey.startDate;
  const changed = current !== journey.startDate;

  const apply = async (): Promise<void> => {
    const ok = await confirmAction({
      title: 'Change your Day 1 date?',
      message:
        'Day numbers and unlock dates will be recalculated. Early unlocks are kept.',
      confirmLabel: 'Change start date',
    });
    if (!ok) {
      setDate(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateJourneyStartDate(journey.id, current);
      setDate(null);
      reload();
    } catch (e) {
      setError(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <AppText variant="heading" style={{ marginBottom: 0 }}>
        Day 1 start date
      </AppText>
      <AppText variant="caption" muted>
        {`Journey ${journey.number} started ${formatDisplayDate(journey.startDate)}`}
      </AppText>
      <ErrorBanner error={error} />

      <DateField
        label="New Day 1 date"
        value={current}
        onChange={setDate}
        maxDate={todayLocal()}
      />

      {changed ? (
        <View style={{ gap: theme.spacing.xs }}>
          <Button label="Save new start date" onPress={() => void apply()} loading={busy} />
          <Button label="Cancel" variant="ghost" onPress={() => setDate(null)} disabled={busy} />
        </View>
      ) : null}

      <Button label="Open journeys" variant="ghost" onPress={() => router.push(ROUTES.journeys)} />

      <AppText variant="caption" muted>
        {LOCK_NOTE_TEXT}
      </AppText>
    </Card>
  );
}