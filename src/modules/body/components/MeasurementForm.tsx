/**
 * INTEGRATION CONTRACT: internal component (A6 body)
 * Purpose: add or edit one measurement. The unit follows the profile's unit system for weight, and a
 *          custom measurement needs a label.
 * Canonical definition: AGENT_06_PROMPT.md §3 (`body/components/MeasurementForm.tsx`)
 * Consumers: MeasurementsScreen.tsx
 * Contract status: APPROVED (internal symbol, no registry ID)
 */
import React, { useState } from 'react';
import { View } from 'react-native';
// CONTRACT: API-UNIT-008 (A1) — the weight unit label
import { weightUnitLabel } from '@/shared/utils/units';
import { Button } from '@/shared/ui/Button';
import { AppText } from '@/shared/ui/AppText';
import { Card } from '@/shared/ui/Card';
import { Segmented } from '@/shared/ui/Chip';
import { DateField, NumberField, TextField } from '@/shared/ui/fields';
import { useTheme } from '@/shared/ui/theme';
import { toLocalDate } from '@/shared/utils/dates';
import type { LocalDate } from '@/shared/types/common';
import type { UnitSystem } from '@/shared/types/profile';
import type { Measurement, MeasurementInput, MeasurementType } from '@/shared/types/body';

const TYPE_OPTIONS: Array<{ value: MeasurementType; label: string }> = [
  { value: 'weight', label: 'Weight' },
  { value: 'waist', label: 'Waist' },
  { value: 'thigh', label: 'Thigh' },
  { value: 'custom', label: 'Other' },
];

export interface MeasurementFormProps {
  measurement: Measurement | null;
  unitSystem: UnitSystem;
  onSave(input: MeasurementInput): void;
  onCancel(): void;
  saving: boolean;
  errorMessage: string | null;
}

export function MeasurementForm({
  measurement,
  unitSystem,
  onSave,
  onCancel,
  saving,
  errorMessage,
}: MeasurementFormProps): React.JSX.Element {
  const theme = useTheme();
  const weightUnit = weightUnitLabel(unitSystem);
  const [type, setType] = useState<MeasurementType>(measurement?.type ?? 'weight');
  const [value, setValue] = useState<number | null>(measurement?.value ?? null);
  const [customLabel, setCustomLabel] = useState(measurement?.customLabel ?? '');
  const [date, setDate] = useState<LocalDate>(measurement?.localDate ?? toLocalDate(new Date()));
  const [note, setNote] = useState(measurement?.note ?? '');
  const [localError, setLocalError] = useState<string | null>(null);

  const unit = type === 'weight' ? weightUnit : type === 'custom' ? (measurement?.unit ?? 'cm') : 'cm';

  const submit = (): void => {
    if (value === null || value <= 0) {
      setLocalError('Enter a value greater than zero.');
      return;
    }
    if (type === 'custom' && customLabel.trim().length === 0) {
      setLocalError('Give this measurement a name.');
      return;
    }
    setLocalError(null);
    onSave({
      type,
      value,
      unit,
      customLabel: type === 'custom' ? customLabel.trim() : null,
      measuredAt: new Date(`${date}T12:00:00`).toISOString(),
      note: note.trim().length > 0 ? note.trim() : null,
    });
  };

  return (
    <Card>
      <Segmented options={TYPE_OPTIONS} value={type} onChange={(next) => setType(next as MeasurementType)} />

      {type === 'custom' ? (
        <TextField label="What is it?" value={customLabel} onChangeText={setCustomLabel} />
      ) : null}

      <NumberField
        label="Value"
        value={value}
        min={0}
        onChange={setValue}
        unit={unit}
      />
      <DateField label="Date" value={date} onChange={setDate} maxDate={toLocalDate(new Date())} />
      <TextField label="Note (optional)" value={note} onChangeText={setNote} multiline />

      {localError || errorMessage ? (
        <AppText variant="caption" style={{ color: theme.colors.danger }}>
          {localError ?? errorMessage}
        </AppText>
      ) : null}

      <View style={{ gap: theme.spacing.xs, marginTop: theme.spacing.sm }}>
        <Button
          label={measurement ? 'Save measurement' : 'Add measurement'}
          onPress={submit}
          loading={saving}
        />
        <Button label="Cancel" variant="ghost" onPress={onCancel} disabled={saving} />
      </View>
    </Card>
  );
}