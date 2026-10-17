/**
 * INTEGRATION CONTRACT: CMP-JRN-001
 * Purpose: the journal list. The header says "Tracking only — not a diagnosis" and nothing on the
 *          screen interprets what was written.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CMP-JRN-001), REQ-JRN-001
 * Consumers: src/app/journal/index.tsx (A7)
 * Contract status: APPROVED
 */
import React, { useCallback } from 'react';
import { router } from 'expo-router';
// CONTRACT: API-JRN-004 (A6 self)
import { listJournalEntries } from '@/modules/journal';
// CONTRACT: CONST-NAV-001 (A1) — route builder
import { ROUTES } from '@/shared/navigation/routes';
// CONST-TEXT-009 (A1) — the fixed symptom labels
import { SYMPTOM_FLAG_LABELS } from '@/shared/constants/text';
import { Screen } from '@/shared/ui/Screen';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState, ErrorBanner, LoadingView } from '@/shared/ui/feedback';
import { useFocusLoad } from '@/shared/ui/useFocusLoad';
import { formatDisplayDate } from '@/shared/utils/dates';
import type { JournalEntry } from '@/shared/types/journal';

function summary(entry: JournalEntry): string {
  const parts: string[] = [];
  if (entry.painScore !== null) {
    parts.push(`pain ${entry.painScore}/10`);
  }
  if (entry.stiffnessScore !== null) {
    parts.push(`stiffness ${entry.stiffnessScore}/10`);
  }
  if (entry.swellingLevel !== null) {
    parts.push(`swelling: ${entry.swellingLevel}`);
  }
  if (entry.symptomFlags.length > 0) {
    parts.push(
      entry.symptomFlags.map((flag) => SYMPTOM_FLAG_LABELS[flag]).filter(Boolean).join(', '),
    );
  }
  return parts.length > 0 ? parts.join(' · ') : 'no scores recorded';
}

export function JournalScreen(): React.JSX.Element {
  const load = useCallback(async (): Promise<JournalEntry[]> => listJournalEntries({ limit: 200 }), []);
  const { data, loading, error } = useFocusLoad(load, []);

  return (
    <Screen>
      <AppText variant="title">Recovery journal</AppText>
      <AppText muted>Tracking only — not a diagnosis.</AppText>

      <ErrorBanner error={error} />
      <Button label="New entry" onPress={() => router.push(ROUTES.journalEntry('new'))} />

      {loading && !data ? <LoadingView /> : null}

      {!loading && (data ?? []).length === 0 ? (
        <EmptyState
          title="No entries yet"
          message="Optional. Add one after a session if you want to note how you felt."
          action={{ label: 'New entry', onPress: () => router.push(ROUTES.journalEntry('new')) }}
        />
      ) : null}

      {(data ?? []).map((entry) => (
        <Card key={entry.id} onPress={() => router.push(ROUTES.journalEntry(entry.id))}>
          <AppText variant="heading" style={{ marginBottom: 0 }}>
            {formatDisplayDate(entry.localDate)}
          </AppText>
          <AppText variant="caption" muted>
            {summary(entry)}
          </AppText>
          {entry.notes ? (
            <AppText variant="caption" muted>
              {entry.notes.length > 120 ? `${entry.notes.slice(0, 120)}…` : entry.notes}
            </AppText>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}