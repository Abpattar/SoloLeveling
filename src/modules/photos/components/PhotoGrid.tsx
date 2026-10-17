/**
 * INTEGRATION CONTRACT: internal component (A5 photos)
 * Purpose: renders ONLY visible photos. It filters defensively as well as relying on the data layer,
 *          so a locked view can never reach an `<Image>` even if a future change produced one.
 * Canonical definition: AGENT_05_PROMPT.md §3, ERROR_HANDLING_AND_SECURITY SEC-08
 * Consumers: PhotosHomeScreen.tsx, PhotoComparisonScreen.tsx, PhotoTimelineScreen.tsx
 * Contract status: APPROVED (internal symbol, no registry ID)
 */
import React from 'react';
import { Image, View } from 'react-native';
import { AppText } from '@/shared/ui/AppText';
import { useTheme } from '@/shared/ui/theme';
import type { ProgressPhotoView } from '@/shared/types/photos';

export interface PhotoGridProps {
  photos: ProgressPhotoView[];
  emptyLabel?: string;
  columns?: 2;
}

/** The one place a progress photo image is rendered. Filters locked views out, always. */
export function PhotoGrid({
  photos,
  emptyLabel = 'No photos yet.',
  columns = 2,
}: PhotoGridProps): React.JSX.Element {
  const theme = useTheme();
  const visible = photos.filter((photo) => photo.visible && photo.imageUri !== null);

  if (visible.length === 0) {
    return (
      <AppText variant="caption" muted>
        {emptyLabel}
      </AppText>
    );
  }

  const width = '48%';
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
      {visible.map((photo) => (
        <View key={photo.id} style={{ width: width as `${number}%`, marginBottom: theme.spacing.sm }}>
          <Image
            source={{ uri: photo.imageUri as string }}
            style={{ width: '100%', height: 160, borderRadius: theme.radius.sm }}
            accessibilityLabel={`Progress photo from Day ${photo.dayNumber}`}
          />
          <AppText variant="caption" muted>
            {`Day ${photo.dayNumber}${photo.category ? ` · ${photo.category}` : ''}`}
          </AppText>
        </View>
      ))}
    </View>
  );
}