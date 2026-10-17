/**
 * INTEGRATION CONTRACT: CMP-PHOTO-005
 * Purpose: the journey list, and the one action that starts the next journey. Starting Journey n+1
 *          is only offered once Journey n's Day 90 is unlocked, and always asks first.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CMP-PHOTO-005), SHARED_CONTRACT Â§10, GAT-026
 * Consumers: src/app/photos/journeys.tsx (A7)
 * Contract status: APPROVED
 */
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
// API-PHOTO-001/003/005/007 + API-PHOTO-016 (A5 self)
import {
  getMilestoneUnlockDate,
  isMilestoneUnlocked,
  listJourneys,
  listProgressPhotos,
  loadEarlyUnlockedDays,
  startNextJourney,
} from '@/modules/photos';
// CONTRACT: API-UI-001 (A1) â€” confirmation before starting a new journey
import { confirmAction } from '@/shared/ui/confirmAction';
// CONTRACT: CONST-NAV-001 (A1) â€” route builders
import { ROUTES } from '@/shared/navigation/routes';
import { Screen } from '@/shared/ui/Screen';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState, ErrorBanner, LoadingView } from '@/shared/ui/feedback';
import { useFocusLoad } from '@/shared/ui/useFocusLoad';
import { useTheme } from '@/shared/ui/theme';
import { toAppError } from '@/shared/errors/AppError';
import { formatDisplayDate, todayLocal } from '@/shared/utils/dates';
import type { Journey, MilestoneDay } from '@/shared/types/photos';

interface JourneyRowData {
  journey: Journey;
  photoCount: number;
  day90Unlocked: boolean;
}

export function JourneysScreen(): React.JSX.Element {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<JourneyRowData[]> => {
    const journeys = await listJourneys();
    const today = todayLocal();
    const rows: JourneyRowData[] = [];
    for (const journey of journeys) {
      const [photos, earlyUnlockedDays] = await Promise.all([
        listProgressPhotos(journey.id),
        loadEarlyUnlockedDays(journey.id),
      ]);
      rows.push({
        journey,
        photoCount: photos.length,
        day90Unlocked: isMilestoneUnlocked({
          startDate: journey.startDate,
          today,
          day: 90,
          earlyUnlockedDays,
        }),
      });
    }
    return rows;
  }, []);

  const { data, loading, error, reload } = useFocusLoad(load, []);

  const startNext = async (journey: Journey): Promise<void> => {
    const ok = await confirmAction({
      title: `Start Journey ${journey.number + 1}?`,
      message: `Journey ${journey.number} will be saved. Journey ${
        journey.number + 1
      } starts today and its photos lock again until Day 30, 60 and 90.`,
      confirmLabel: `Start Journey ${journey.number + 1}`,
    });
    if (!ok) {
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      await startNextJourney();
      reload();
    } catch (e) {
      setActionError(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <AppText variant="title">Journeys</AppText>
      <AppText muted>
        Each journey is 90 days with its own Day 30, 60 and 90 unlocks. Nothing changes without you.
      </AppText>
      <ErrorBanner error={error ?? actionError} />
      {loading && !data ? <LoadingView /> : null}

      {!loading && (data ?? []).length === 0 ? (
        <EmptyState title="No journeys yet" message="Finish setup to choose your Day 1 date." />
      ) : null}

      {(data ?? []).map((row) => (
        <Card key={row.journey.id}>
          <AppText variant="heading" style={{ marginBottom: 0 }}>
            {`Journey ${row.journey.number} Â· ${row.journey.status}`}
          </AppText>
          <AppText variant="caption" muted>
            {`Started ${formatDisplayDate(row.journey.startDate)}`}
          </AppText>
          {row.journey.completedOn ? (
            <AppText variant="caption" muted>
              {`Finished ${formatDisplayDate(row.journey.completedOn)}`}
            </AppText>
          ) : null}
          <AppText variant="caption" muted>
            {`Day 90 unlock: ${formatDisplayDate(
              getMilestoneUnlockDate(row.journey.startDate, 90 as MilestoneDay),
            )}${row.day90Unlocked ? ' (unlocked)' : ''}`}
          </AppText>
          <AppText variant="caption" muted>
            {`${row.photoCount} progress photo${row.photoCount === 1 ? '' : 's'}`}
          </AppText>

          <View style={{ gap: theme.spacing.xs, marginTop: theme.spacing.sm }}>
            <Button
              label="Day 30 comparison"
              variant="secondary"
              onPress={() => router.push(ROUTES.photoCompare(row.journey.id, 30))}
            />
            <Button
              label="Day 60 comparison"
              variant="secondary"
              onPress={() => router.push(ROUTES.photoCompare(row.journey.id, 60))}
            />
            <Button
              label="Day 90 comparison"
              variant="secondary"
              onPress={() => router.push(ROUTES.photoCompare(row.journey.id, 90))}
            />
            <Button
              label="Timeline"
              variant="ghost"
              onPress={() => router.push(ROUTES.photoTimeline(row.journey.id))}
            />
            {row.journey.status === 'active' && row.day90Unlocked ? (
              <Button
                label={`Start Journey ${row.journey.number + 1}`}
                onPress={() => void startNext(row.journey)}
                loading={busy}
              />
            ) : null}
          </View>
        </Card>
      ))}
    </Screen>
  );
}

