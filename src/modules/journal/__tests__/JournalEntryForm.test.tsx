import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { JournalEntryForm } from '../components/JournalEntryForm';
import { SAFETY_ADVICE_TITLE } from '@/shared/constants/text';
import type { JournalEntry, JournalEntryInput } from '@/shared/types/journal';

function entry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: 'e1',
    localDate: '2026-03-10',
    recordedAt: '2026-03-10T18:00:00.000Z',
    painScore: null,
    stiffnessScore: null,
    swellingLevel: null,
    symptomFlags: [],
    notes: null,
    createdAt: '2026-03-10T18:00:00.000Z',
    updatedAt: '2026-03-10T18:00:00.000Z',
    ...overrides,
  };
}

async function renderForm(props: {
  entry?: JournalEntry | null;
  painAlertLevel?: number | null;
  onSubmit?: (values: JournalEntryInput) => void;
}): Promise<void> {
  await render(
    <JournalEntryForm
      entry={props.entry ?? null}
      painAlertLevel={props.painAlertLevel ?? null}
      saving={false}
      onSubmit={props.onSubmit ?? (() => undefined)}
      onCancel={() => undefined}
    />,
  );
}

describe('JournalEntryForm (GAT-011)', () => {
  it('shows no advice card when nothing is ticked', async () => {
    await renderForm({ entry: entry() });

    expect(screen.queryByText(SAFETY_ADVICE_TITLE)).toBeNull();
  });

  it('shows the safety card as soon as a warning symptom is ticked (GAT-011)', async () => {
    await renderForm({ entry: entry({ symptomFlags: ['sharp_or_increasing_pain'] }) });

    expect(screen.getByText(SAFETY_ADVICE_TITLE)).toBeTruthy();
  });

  it('shows the safety card when pain reaches the user-set alert level (GAT-011)', async () => {
    await renderForm({ entry: entry({ painScore: 7 }), painAlertLevel: 7 });

    expect(screen.getByText(SAFETY_ADVICE_TITLE)).toBeTruthy();
  });

  it('shows no card for pain below the alert level', async () => {
    await renderForm({ entry: entry({ painScore: 3 }), painAlertLevel: 7 });

    expect(screen.queryByText(SAFETY_ADVICE_TITLE)).toBeNull();
  });

  it('shows no card when no alert level has been set and no flag is ticked', async () => {
    await renderForm({ entry: entry({ painScore: 10 }), painAlertLevel: null });

    expect(screen.queryByText(SAFETY_ADVICE_TITLE)).toBeNull();
  });

  it('offers saving even while advice is showing', async () => {
    await renderForm({ entry: entry({ symptomFlags: ['numbness_or_tingling'] }) });

    expect(screen.getByText('Save entry')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('does not show a delete button for a new entry', async () => {
    await renderForm({ entry: null });

    expect(screen.queryByText('Delete entry')).toBeNull();
  });

  it('renders the existing values of a stored entry', async () => {
    await renderForm({ entry: entry({ painScore: 4, notes: 'slept well' }) });

    expect(screen.getByDisplayValue('4')).toBeTruthy();
    expect(screen.getByDisplayValue('slept well')).toBeTruthy();
  });
});