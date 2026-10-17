/**
 * INTEGRATION CONTRACT: CMP-PHOTO-001
 * Purpose: the Photos tab. Header, the three milestones, the visible photo grid, and the way in to
 *          capture, timeline and journeys. Locked photos are only ever described, never shown.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CMP-PHOTO-001), SHARED_CONTRACT §10
 * Consumers: src/app/(tabs)/photos.tsx (A7)
 * Contract status: APPROVED
 */
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
// API-PHOTO-001/007/008 (A5 self)
import {
  getActiveJourney,
  getMilestoneStates,
  listProgressPhotos,
  unlockMilestoneEarly,
} from '@/modules/photos';
// HOOK-PHOTO-001 (A5 self)
import { useActiveJourney } from '@/modules/photos/hooks/useActiveJourney';
// CONTRACT: API-UI-001 (A1) — confirmation before revealing locked photos
import { confirmAction } from '@/shared/ui/confirmAction';
// CONST-TEXT-005 (A1) — the fixed "motivation, not encryption" note
import { LOCK_NOTE_TEXT } from '@/shared/constants/text';
// CONTRACT: CONST-NAV-001 (A1) — route builders
import { ROUTES } from '@/shared/navigation/routes';
import { Screen } from '@/shared/ui/Screen';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { EmptyState, ErrorBanner, LoadingView } from '@/shared/ui/feedback';
import { useFocusLoad } from '@/shared/ui/useFocusLoad';
import { useTheme } from '@/shared/ui/theme';
import { toAppError } from '@/shared/errors/AppError';
import { MilestoneCard } from '@/modules/photos/components/MilestoneCard';
import { PhotoGrid } from '@/modules/photos/components/PhotoGrid';
import type { MilestoneDay, MilestoneState, ProgressPhotoView } from '@/shared/types/photos';

interface PhotosData {
  states: MilestoneState[];
  photos: ProgressPhotoView[];
}

export function PhotosHomeScreen(): React.JSX.Element {
  const theme = useTheme();
  const { journey, dayNumber } = useActiveJourney();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<PhotosData | null> => {
    const active = await getActiveJourney();
    if (active === null) {
      return null;
    }
    const [states, photos] = await Promise.all([
      getMilestoneStates(active.id),
      listProgressPhotos(active.id),
    ]);
    return { states, photos };
  }, []);

  const { data, loading, error, reload } = useFocusLoad(load, [journey?.id]);

  const unlockEarly = async (state: MilestoneState): Promise<void> => {
    const ok = await confirmAction({
      title: 'Unlock early?',
      message: `This reveals your Day ${state.day} photos before the planned date. You cannot re-lock them.`,
      confirmLabel: 'Unlock early',
      cancelLabel: 'Keep them hidden',
      destructive: false,
    });
    if (!ok) {
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      await unlockMilestoneEarly(state.journeyId, state.day as MilestoneDay, { confirmed: true });
      reload();
    } catch (e) {
      setActionError(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  };

  if (!journey) {
    return (
      <Screen>
        <AppText variant="title">Progress photos</AppText>
        <ErrorBanner error={error} />
        <EmptyState
          title="No journey yet"
          message="Finish the setup in Settings to choose your Day 1 date, then progress photos will lock to Day 30, 60 and 90."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppText variant="title">{`Journey ${journey.number} · Day ${dayNumber ?? 1}`}</AppText>
      <ErrorBanner error={error ?? actionError} />

      <View style={{ gap: theme.spacing.sm, marginVertical: theme.spacing.sm }}>
        <Button label="Take progress photo" onPress={() => router.push(ROUTES.photoCapture())} />
        <Button
          label="Timeline"
          variant="secondary"
          onPress={() => router.push(ROUTES.photoTimeline(journey.id))}
        />
        <Button
          label="Journeys"
          variant="secondary"
          onPress={() => router.push(ROUTES.journeys)}
        />
      </View>

      {loading && !data ? <LoadingView /> : null}

      {(data?.states ?? []).map((state) => (
        <MilestoneCard
          key={state.day}
          state={state}
          busy={busy}
          onUnlockEarly={() => void unlockEarly(state)}
          onViewComparison={() => router.push(ROUTES.photoCompare(journey.id, state.day))}
        />
      ))}

      <PhotoGrid
        photos={data?.photos ?? []}
        emptyLabel="No photos yet. Take one after a session if you want to."
      />

      <AppText variant="caption" muted>
        {LOCK_NOTE_TEXT}
      </AppText>
    </Screen>
  );
}