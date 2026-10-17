/**
 * INTEGRATION CONTRACT: internal component (A6 journal)
 * Purpose: the fields of one journal entry. Field state is initialised once from the loaded entry,
 *          so there is no effect and no cascading render. Ticking a symptom, or reaching the user's
 *          own pain alert level, shows the fixed advice immediately.
 * Canonical definition: AGENT_06_PROMPT.md §3 (`journal/screens/JournalEntryScreen.tsx`)
 * Consumers: JournalEntryScreen.tsx
 * Contract status: APPROVED (internal symbol, no registry ID)
 */
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
// CONTRACT: API-SAFE-001 (A1) — the only place the advice is decided
import { evaluateSymptomReport } from '@/shared/domain/safety';
// CMP-SAFE-001/002 (A1) — checklist and advice card
import { SafetyAdviceCard, SymptomChecklist } from '@/shared/ui/safetyUi';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { DateField, NumberField, TextField } from '@/shared/ui/fields';
import { Segmented } from '@/shared/ui/Chip';
import { useTheme } from '@/shared/ui/theme';
import { todayLocal } from '@/shared/utils/dates';
import type { LocalDate } from '@/shared/types/common';
import type { JournalEntry, JournalEntryInput, SwellingLevel } from '@/shared/types/journal';
import type { SymptomReport } from '@/shared/types/safety';

const SWELLING_OPTIONS: Array<{ value: SwellingLevel; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'mild', label: 'Mild' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'significant', label: 'Significant' },
];

export interface JournalEntryFormProps {
  entry: JournalEntry | null;
  painAlertLevel: number | null;
  saving: boolean;
  onSubmit(values: JournalEntryInput): void;
  onDelete?(): void;
  onCancel(): void;
}

export function JournalEntryForm({
  entry,
  painAlertLevel,
  saving,
  onSubmit,
  onDelete,
  onCancel,
}: JournalEntryFormProps): React.JSX.Element {
  const theme = useTheme();
  const [date, setDate] = useState<LocalDate>(entry?.localDate ?? todayLocal());
  const [pain, setPain] = useState<number | null>(entry?.painScore ?? null);
  const [stiffness, setStiffness] = useState<number | null>(entry?.stiffnessScore ?? null);
  const [swelling, setSwelling] = useState<SwellingLevel | null>(entry?.swellingLevel ?? null);
  const [report, setReport] = useState<SymptomReport>({
    flags: entry?.symptomFlags ?? [],
    painScore: entry?.painScore ?? null,
  });
  const [notes, setNotes] = useState(entry?.notes ?? '');

  // Pain can be typed here or ticked on the checklist; the checklist value wins if both are set.
  const advice = useMemo(
    () =>
      evaluateSymptomReport(
        { flags: report.flags, painScore: report.painScore ?? pain },
        painAlertLevel,
      ),
    [report, pain, painAlertLevel],
  );

  const submit = (): void => {
    onSubmit({
      localDate: date,
      painScore: report.painScore ?? pain,
      stiffnessScore: stiffness,
      swellingLevel: swelling,
      symptomFlags: report.flags,
      notes: notes.trim().length > 0 ? notes.trim() : null,
    });
  };

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <DateField label="Date" value={date} onChange={setDate} maxDate={todayLocal()} />
      <NumberField label="Pain" value={pain} integer min={0} max={10} onChange={setPain} />
      <NumberField
        label="Stiffness"
        value={stiffness}
        integer
        min={0}
        max={10}
        onChange={setStiffness}
      />

      <AppText variant="label" muted>
        Swelling
      </AppText>
      <Segmented
        options={SWELLING_OPTIONS}
        value={swelling ?? 'none'}
        onChange={(value) => setSwelling(value === 'none' ? null : value)}
      />

      <SymptomChecklist value={report} onChange={setReport} />
      {advice ? <SafetyAdviceCard advice={advice} /> : null}

      <TextField label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />

      <Button
        label="Save entry"
        onPress={submit}
        loading={saving}
      />
      {onDelete ? (
        <Button label="Delete entry" variant="danger" onPress={onDelete} disabled={saving} />
      ) : null}
      <Button label="Cancel" variant="ghost" onPress={onCancel} disabled={saving} />
    </View>
  );
}