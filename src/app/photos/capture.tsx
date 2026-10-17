// CONTRACT: CMP-PHOTO-002 (A5)
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ProgressPhotoCaptureScreen } from '@/modules/photos';

export default function PhotoCaptureRoute(): React.JSX.Element {
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  return <ProgressPhotoCaptureScreen sessionId={sessionId ?? null} />;
}
