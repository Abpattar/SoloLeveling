/**
 * INTEGRATION CONTRACT: CMP-JRN-002
 * Purpose: one journal entry. Saving is always allowed; the fixed safety advice never blocks saving
 *          and never changes the exercise plan (SAF-03, GAT-011).
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CMP-JRN-002), ERROR_HANDLING SAF-03, GAT-011
 * Consumers: src/app/journal/[entryId].tsx (A7)
 * Contract status: APPROVED
 */
import React, { useCallback, useState } from 'react';
import { router } from 'expo-router';
// CONTRACT: API-JRN-001/002/003/006 (A6 self)
import {
  createJournalEntry,
  deleteJournalEntry,
  getJournalEntry,
  updateJournalEntry,
} from '@/modules/journal';
import { JournalEntryForm } from '../components/JournalEntryForm';
// CONTRACT: HOOK-SET-001 (A1) — the user's own alert level
import { useSettings } from '@/shared/settings/SettingsProvider';
// CONTRACT: API-UI-001 (A1) — confirmation before deleting
import { confirmAction } from '@/shared/ui/confirmAction';
import { Screen } from '@/shared/ui/Screen';
import { AppText } from '@/shared/ui/AppText';
import { EmptyState, ErrorBanner, LoadingView } from '@/shared/ui/feedback';
import { useFocusLoad } from '@/shared/ui/useFocusLoad';
import { toAppError } from '@/shared/errors/AppError';
import type { JournalEntry, JournalEntryInput } from '@/shared/types/journal';

export interface JournalEntryScreenProps {
  entryId: string | null;
}

export function JournalEntryScreen({ entryId }: JournalEntryScreenProps): React.JSX.Element {
  const { settings } = useSettings();
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<JournalEntry | null> => {
    if (entryId === null) {
      return null;
    }
    return getJournalEntry(entryId);
  }, [entryId]);

  const { data, loading, error } = useFocusLoad(load, [entryId]);

  const save = async (values: JournalEntryInput): Promise<void> => {
    setSaving(true);
    setActionError(null);
    try {
      if (entryId === null) {
        await createJournalEntry(values);
      } else {
        await updateJournalEntry(entryId, values);
      }
      router.back();
    } catch (e) {
      setActionError(toAppError(e).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (): Promise<void> => {
    if (entryId === null) {
      return;
    }
    const ok = await confirmAction({
      title: 'Delete this entry?',
      message: 'It is removed permanently.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) {
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      await deleteJournalEntry(entryId);
      router.back();
    } catch (e) {
      setActionError(toAppError(e).message);
    } finally {
      setSaving(false);
    }
  };

  if (entryId !== null && loading && !data) {
    return (
      <Screen>
        <LoadingView />
      </Screen>
    );
  }

  if (entryId !== null && !data && !loading) {
    return (
      <Screen>
        <ErrorBanner error={error} />
        <EmptyState
          title="Entry not found"
          message="It may have been deleted."
          action={{ label: 'Back to journal', onPress: () => router.back() }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppText variant="title">{entryId === null ? 'New journal entry' : 'Journal entry'}</AppText>
      <AppText muted>Tracking only — not a diagnosis.</AppText>
      <ErrorBanner error={error ?? actionError} />

      <JournalEntryForm
        key={entryId ?? 'new'}
        entry={data}
        painAlertLevel={settings.safety.painAlertLevel}
        saving={saving}
        onSubmit={(values) => void save(values)}
        onDelete={entryId !== null ? () => void remove() : undefined}
        onCancel={() => router.back()}
      />
    </Screen>
  );
}