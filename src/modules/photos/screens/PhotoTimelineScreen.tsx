/**
 * INTEGRATION CONTRACT: CMP-PHOTO-004
 * Purpose: a selected-day timeline. Only exact-day, visible photos appear; every other selected day
 *          says so, without hinting at what is hidden.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CMP-PHOTO-004), GAT-032
 * Consumers: src/app/photos/timeline/[journeyId].tsx (A7)
 * Contract status: APPROVED
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Image, View } from 'react-native';
import { router } from 'expo-router';
// CONST-PHOTO-002 + API-PHOTO-013 (A5 self)
import { DEFAULT_TIMELINE_DAYS, getTimelineSlots, listJourneys } from '@/modules/photos';
import { Screen } from '@/shared/ui/Screen';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Chip } from '@/shared/ui/Chip';
import { NumberField } from '@/shared/ui/fields';
import { ErrorBanner, LoadingView } from '@/shared/ui/feedback';
import { useFocusLoad } from '@/shared/ui/useFocusLoad';
import { useTheme } from '@/shared/ui/theme';
import { formatDisplayDate } from '@/shared/utils/dates';
import type { TimelineSlot } from '@/shared/types/photos';

export interface PhotoTimelineScreenProps {
  journeyId: string;
}

export function PhotoTimelineScreen({ journeyId }: PhotoTimelineScreenProps): React.JSX.Element {
  const theme = useTheme();
  const [days, setDays] = useState<number[]>([...DEFAULT_TIMELINE_DAYS]);
  const [customDay, setCustomDay] = useState<number | null>(null);

  const load = useCallback(async (): Promise<TimelineSlot[]> => {
    // The journey is validated by `getTimelineSlots`, which throws NOT_FOUND for an unknown id.
    void (await listJourneys()).find((entry) => entry.id === journeyId);
    return getTimelineSlots(journeyId, days);
  }, [journeyId, days]);

  const { data, loading, error } = useFocusLoad(load, [journeyId, days.join(',')]);

  const sortedDays = useMemo(() => [...days].sort((a, b) => a - b), [days]);

  return (
    <Screen>
      <AppText variant="title">Timeline</AppText>
      <ErrorBanner error={error} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {sortedDays.map((day) => (
          <Chip
            key={day}
            label={`Day ${day}`}
            selected
            onPress={() =>
              setDays((current) => (current.includes(day) ? current : [...current, day]))
            }
          />
        ))}
      </View>

      <Card>
        <NumberField
          label="Add a day number"
          value={customDay}
          integer
          min={1}
          max={400}
          onChange={setCustomDay}
        />
        <Button
          label="Add day"
          variant="secondary"
          onPress={() => {
            if (customDay !== null && customDay >= 1) {
              setDays((current) => (current.includes(customDay) ? current : [...current, customDay]));
            }
          }}
        />
        <AppText variant="caption" muted>
          Only the days you choose are shown, and only if a visible photo exists for that exact day.
        </AppText>
      </Card>

      {loading && !data ? <LoadingView /> : null}

      {(data ?? []).map((slot) => {
        const photo = slot.photo;
        const visible = photo !== null && photo.visible && photo.imageUri !== null;
        return (
          <Card key={slot.day}>
            <AppText variant="heading" style={{ marginBottom: 0 }}>
              {`Day ${slot.day}`}
            </AppText>
            {visible && photo ? (
              <>
                <Image
                  source={{ uri: photo.imageUri as string }}
                  style={{ width: '100%', height: 240, borderRadius: theme.radius.sm }}
                  accessibilityLabel={`Progress photo from Day ${slot.day}`}
                />
                <AppText variant="caption" muted>
                  {formatDisplayDate(photo.capturedOn)}
                </AppText>
              </>
            ) : (
              <AppText variant="caption" muted>
                No photo / locked
              </AppText>
            )}
          </Card>
        );
      })}

      <Button label="Back" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}