// CONTRACT: CMP-JRN-002 (A6) — the literal 'new' means "create", not "edit"
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { JournalEntryScreen } from '@/modules/journal';

export default function JournalEntryRoute(): React.JSX.Element {
  const { entryId } = useLocalSearchParams<{ entryId: string }>();
  return <JournalEntryScreen entryId={entryId === 'new' ? null : entryId} />;
}
