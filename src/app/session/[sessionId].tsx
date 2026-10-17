// CONTRACT: CMP-TRN-006 (A2) — one saved session
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { SessionDetailScreen } from '@/modules/training';

export default function SessionDetailRoute(): React.JSX.Element {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  return <SessionDetailScreen sessionId={sessionId} />;
}
