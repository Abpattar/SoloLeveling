// CONTRACT: CMP-TRN-004 (A2) — session summary
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { SessionCompleteScreen } from '@/modules/training';

export default function SessionCompleteRoute(): React.JSX.Element {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  return <SessionCompleteScreen sessionId={sessionId} />;
}
