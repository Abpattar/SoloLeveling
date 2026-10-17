// CONTRACT: CMP-PHOTO-004 (A5) — the timeline of one journey
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { PhotoTimelineScreen } from '@/modules/photos';

export default function PhotoTimelineRoute(): React.JSX.Element {
  const { journeyId } = useLocalSearchParams<{ journeyId: string }>();
  return <PhotoTimelineScreen journeyId={journeyId} />;
}
