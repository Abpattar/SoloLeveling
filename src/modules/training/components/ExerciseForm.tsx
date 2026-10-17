/**
 * INTEGRATION CONTRACT: internal component (A2 training)
 * Purpose: the whole exercise create/edit form. It collects exactly what the user was told to do and
 *          nothing else; there is no suggestion engine and no auto-progression.
 * Canonical definition: AGENT_02_PROMPT.md §3 (`components/ExerciseForm.tsx`), REQ-EXR-001
 * Consumers: ExerciseEditorScreen.tsx
 * Contract status: APPROVED (internal symbol, no registry ID)
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Chip, Segmented } from '@/shared/ui/Chip';
import { NumberField, TextField } from '@/shared/ui/fields';
import { useTheme } from '@/shared/ui/theme';
import type {
  Exercise,
  ExerciseInput,
  ExerciseIntensity,
  Weekday,
} from '@/shared/types/training';

const WEEKDAYS: Array<{ value: Weekday; label: string }> = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
];

const INTENSITY_OPTIONS: Array<{ value: 'none' | ExerciseIntensity; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'light', label: 'Light' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'vigorous', label: 'Vigorous' },
];

export interface ExerciseFormProps {
  exercise: Exercise | null;
  onSave(input: ExerciseInput): void;
  onCancel(): void;
  saving: boolean;
  errorMessage: string | null;
}

interface FormState {
  name: string;
  instructions: string;
  sets: number | null;
  reps: number | null;
  durationSeconds: number | null;
  restSeconds: number;
  scheduleDays: Weekday[];
  clinicianNotes: string;
  intensity: 'none' | ExerciseIntensity;
  status: 'active' | 'paused';
}

function initialState(exercise: Exercise | null): FormState {
  return {
    name: exercise?.name ?? '',
    instructions: exercise?.instructions ?? '',
    sets: exercise?.sets ?? 3,
    reps: exercise?.reps ?? null,
    durationSeconds: exercise?.durationSeconds ?? null,
    restSeconds: exercise?.restSeconds ?? 0,
    scheduleDays: exercise?.scheduleDays ?? [],
    clinicianNotes: exercise?.clinicianNotes ?? '',
    intensity: exercise?.intensity ?? 'none',
    status: exercise?.status ?? 'active',
  };
}

export function ExerciseForm({
  exercise,
  onSave,
  onCancel,
  saving,
  errorMessage,
}: ExerciseFormProps): React.JSX.Element {
  const theme = useTheme();
  const [form, setForm] = React.useState<FormState>(() => initialState(exercise));
  const [localError, setLocalError] = React.useState<string | null>(null);

  const patch = (next: Partial<FormState>): void => setForm((prev) => ({ ...prev, ...next }));

  const toggleDay = (day: Weekday): void => {
    patch({
      scheduleDays: form.scheduleDays.includes(day)
        ? form.scheduleDays.filter((d) => d !== day)
        : [...form.scheduleDays, day].sort((a, b) => a - b),
    });
  };

  const submit = (): void => {
    if (form.sets === null) {
      setLocalError('Enter how many sets to do.');
      return;
    }
    if (form.reps === null && form.durationSeconds === null) {
      setLocalError('Enter repetitions or a duration for this exercise.');
      return;
    }
    if (form.scheduleDays.length === 0) {
      setLocalError('Choose at least one day for this exercise.');
      return;
    }
    setLocalError(null);
    onSave({
      name: form.name,
      instructions: form.instructions,
      sets: form.sets,
      reps: form.reps,
      durationSeconds: form.durationSeconds,
      restSeconds: form.restSeconds ?? 0,
      scheduleDays: form.scheduleDays,
      clinicianNotes: form.clinicianNotes,
      intensity: form.intensity === 'none' ? null : form.intensity,
      status: form.status,
    });
  };

  return (
    <View>
      <TextField
        label="Exercise name"
        value={form.name}
        onChangeText={(name) => patch({ name })}
        placeholder="e.g. Straight leg raise"
      />
      <TextField
        label="How to do it (optional)"
        value={form.instructions}
        onChangeText={(instructions) => patch({ instructions })}
        multiline
      />

      <NumberField
        label="Sets"
        value={form.sets}
        integer
        min={1}
        max={50}
        onChange={(sets) => patch({ sets })}
      />
      <NumberField
        label="Repetitions per set"
        value={form.reps}
        integer
        min={1}
        max={1000}
        onChange={(reps) => patch({ reps })}
      />
      <NumberField
        label="Seconds per set (use this for timed holds)"
        value={form.durationSeconds}
        integer
        min={1}
        max={7200}
        onChange={(durationSeconds) => patch({ durationSeconds })}
      />
      <NumberField
        label="Rest between sets"
        value={form.restSeconds}
        integer
        min={0}
        max={900}
        unit="s"
        onChange={(restSeconds) => patch({ restSeconds: restSeconds ?? 0 })}
      />

      <AppText variant="label" muted>
        Days of the week
      </AppText>
      <View style={[styles.days, { marginBottom: theme.spacing.md }]}>
        {WEEKDAYS.map((day) => (
          <Chip
            key={day.value}
            label={day.label}
            selected={form.scheduleDays.includes(day.value)}
            onPress={() => toggleDay(day.value)}
          />
        ))}
      </View>

      <AppText variant="label" muted>
        Effort (optional)
      </AppText>
      <Segmented
        options={INTENSITY_OPTIONS}
        value={form.intensity}
        onChange={(intensity) => patch({ intensity })}
      />
      <AppText variant="caption" muted>
        Only used for a rough calorie estimate. Leave it off if you were not told.
      </AppText>

      <TextField
        label="Notes from your clinician (optional)"
        value={form.clinicianNotes}
        onChangeText={(clinicianNotes) => patch({ clinicianNotes })}
        multiline
      />

      <Segmented
        options={[
          { value: 'active', label: 'Active' },
          { value: 'paused', label: 'Paused' },
        ]}
        value={form.status}
        onChange={(status) => patch({ status })}
      />

      {localError ? (
        <AppText style={{ color: theme.colors.danger, marginTop: theme.spacing.sm }}>
          {localError}
        </AppText>
      ) : null}
      {errorMessage ? (
        <AppText style={{ color: theme.colors.danger, marginTop: theme.spacing.sm }}>
          {errorMessage}
        </AppText>
      ) : null}

      <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
        <Button label={exercise ? 'Save changes' : 'Add exercise'} onPress={submit} loading={saving} />
        <Button label="Cancel" variant="ghost" onPress={onCancel} disabled={saving} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  days: { flexDirection: 'row', flexWrap: 'wrap' },
});