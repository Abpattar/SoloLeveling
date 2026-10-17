/**
 * INTEGRATION CONTRACT: CMP-PHOTO-003
 * Purpose: side-by-side baseline vs target for one milestone. Locked photos are never shown; when a
 *          side is missing the screen says so plainly instead of hinting at hidden content.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CMP-PHOTO-003), GAT-032
 * Consumers: src/app/photos/compare/[journeyId]/[milestoneDay].tsx (A7)
 * Contract status: APPROVED
 */
import React, { useCallback, useState } from 'react';
import { Image, View } from 'react-native';
import { router } from 'expo-router';
// API-PHOTO-011/012 (A5 self)
import { exportProgressPhoto, getComparisonPairs } from '@/modules/photos';
import { Screen } from '@/shared/ui/Screen';
import { AppText } from '@/shared/ui/AppText';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { EmptyState, ErrorBanner, LoadingView } from '@/shared/ui/feedback';
import { useFocusLoad } from '@/shared/ui/useFocusLoad';
import { useTheme } from '@/shared/ui/theme';
import { formatDisplayDate } from '@/shared/utils/dates';
import { toAppError } from '@/shared/errors/AppError';
import type { ComparisonPair, MilestoneDay, ProgressPhotoView } from '@/shared/types/photos';

export interface PhotoComparisonScreenProps {
  journeyId: string;
  milestoneDay: MilestoneDay;
}

export function isMilestoneDayValue(value: number): value is MilestoneDay {
  return value === 30 || value === 60 || value === 90;
}

function PhotoPane({ photo, label }: { photo: ProgressPhotoView | null; label: string }): React.JSX.Element {
  const theme = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <AppText variant="label" muted>
        {label}
      </AppText>
      {photo && photo.visible && photo.imageUri !== null ? (
        <>
          <Image
            source={{ uri: photo.imageUri }}
            style={{ width: '100%', height: 220, borderRadius: theme.radius.sm }}
            accessibilityLabel={`${label} photo`}
          />
          <AppText variant="caption" muted>
            {`Day ${photo.dayNumber} · ${formatDisplayDate(photo.capturedOn)}`}
          </AppText>
        </>
      ) : (
        <AppText variant="caption" muted>
          No photo yet for this period.
        </AppText>
      )}
    </View>
  );
}

export function PhotoComparisonScreen({
  journeyId,
  milestoneDay,
}: PhotoComparisonScreenProps): React.JSX.Element {
  const theme = useTheme();
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<ComparisonPair[]> => getComparisonPairs(journeyId), [
    journeyId,
  ]);
  const { data, loading, error } = useFocusLoad(load, [journeyId]);

  const pair = data?.find((entry) => entry.milestone === milestoneDay) ?? null;

  const exportPhoto = async (photoId: string): Promise<void> => {
    setActionError(null);
    try {
      const result = await exportProgressPhoto(photoId);
      if (!result.ok) {
        setActionError(result.error.message);
      }
    } catch (e) {
      setActionError(toAppError(e).message);
    }
  };

  if (loading && !data) {
    return (
      <Screen>
        <LoadingView />
      </Screen>
    );
  }

  if (!pair) {
    return (
      <Screen>
        <ErrorBanner error={error} />
        <EmptyState
          title="Nothing to compare"
          message="That milestone does not exist."
          action={{ label: 'Back', onPress: () => router.back() }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppText variant="title">{`Day ${milestoneDay}`}</AppText>
      <ErrorBanner error={error ?? actionError} />

      {!pair.available ? (
        <EmptyState
          title="Not enough photos yet"
          message={
            pair.baseline === null
              ? 'No Day-1 photo yet, so there is nothing to compare against.'
              : `No photo between Day ${milestoneDay === 30 ? 1 : milestoneDay - 30} and Day ${milestoneDay}.`
          }
          action={{ label: 'Take a photo', onPress: () => router.push(`/photos/capture` as never) }}
        />
      ) : (
        <Card>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <PhotoPane photo={pair.baseline} label="Baseline" />
            <PhotoPane photo={pair.target} label={`Day ${milestoneDay}`} />
          </View>
          <AppText variant="caption" muted>
            Compare these yourself. This app does not interpret what changed.
          </AppText>
        </Card>
      )}

      {pair.baseline && pair.baseline.visible ? (
        <Button
          label="Share baseline photo"
          variant="ghost"
          onPress={() => void exportPhoto(pair.baseline!.id)}
        />
      ) : null}
      {pair.target && pair.target.visible ? (
        <Button
          label="Share comparison photo"
          variant="ghost"
          onPress={() => void exportPhoto(pair.target!.id)}
        />
      ) : null}
    </Screen>
  );
}