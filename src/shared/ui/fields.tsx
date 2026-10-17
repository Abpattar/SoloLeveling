/**
 * INTEGRATION CONTRACT: CMP-UI-005 .. CMP-UI-008
 * Purpose: the four form inputs every screen uses. NumberField clamps on change; DateField and
 *          TimeField use the native Android pickers.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CMP-UI-005..008)
 * Consumers: every editor screen
 * Contract status: APPROVED
 */
import React, { useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import { AppText } from './AppText';
import { Button } from './Button';
import { useTheme } from './theme';
import { addDays, isValidLocalDate, isValidLocalTime, parseLocalDate, todayLocal } from '../utils/dates';
import type { LocalDate, LocalTime } from '../types/common';

export interface TextFieldProps {
  label: string;
  value: string;
  onChangeText(t: string): void;
  multiline?: boolean;
  placeholder?: string;
  error?: string | null;
}

/** CMP-UI-005 */
export function TextField({
  label,
  value,
  onChangeText,
  multiline = false,
  placeholder,
  error,
}: TextFieldProps): React.JSX.Element {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: theme.spacing.md }}>
      <AppText variant="label" muted>
        {label}
      </AppText>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        multiline={multiline}
        style={[
          styles.input,
          {
            borderColor: error ? theme.colors.danger : theme.colors.border,
            borderRadius: theme.radius.sm,
            color: theme.colors.text,
            backgroundColor: theme.colors.surface,
            padding: theme.spacing.sm + 2,
            minHeight: multiline ? 88 : 44,
            textAlignVertical: multiline ? 'top' : 'center',
          },
        ]}
      />
      {error ? (
        <AppText variant="caption" style={{ color: theme.colors.danger }}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

export interface NumberFieldProps {
  label: string;
  value: number | null;
  onChange(v: number | null): void;
  min?: number;
  max?: number;
  integer?: boolean;
  unit?: string;
  error?: string | null;
}

/** CMP-UI-006 */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  integer = false,
  unit,
  error,
}: NumberFieldProps): React.JSX.Element {
  const theme = useTheme();
  const [text, setText] = useState(value === null ? '' : String(value));

  const commit = (next: string): void => {
    setText(next);
    const trimmed = next.trim();
    if (trimmed.length === 0) {
      onChange(null);
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      return;
    }
    let out = integer ? Math.round(parsed) : parsed;
    if (min !== undefined && out < min) {
      out = min;
    }
    if (max !== undefined && out > max) {
      out = max;
    }
    onChange(out);
  };

  return (
    <View style={{ marginBottom: theme.spacing.md }}>
      <AppText variant="label" muted>
        {label}
      </AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <TextInput
          accessibilityLabel={label}
          keyboardType={integer ? 'number-pad' : 'decimal-pad'}
          value={text}
          onChangeText={commit}
          style={[
            styles.input,
            {
              borderColor: error ? theme.colors.danger : theme.colors.border,
              borderRadius: theme.radius.sm,
              color: theme.colors.text,
              backgroundColor: theme.colors.surface,
              padding: theme.spacing.sm + 2,
              minHeight: 44,
              flex: 1,
            },
          ]}
        />
        {unit ? (
          <AppText muted style={{ marginBottom: 0 }}>
            {unit}
          </AppText>
        ) : null}
      </View>
      {error ? (
        <AppText variant="caption" style={{ color: theme.colors.danger }}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

export interface DateFieldProps {
  label: string;
  value: LocalDate;
  onChange(d: LocalDate): void;
  maxDate?: LocalDate;
  minDate?: LocalDate;
}

/** CMP-UI-007 */
export function DateField({
  label,
  value,
  onChange,
  maxDate,
  minDate,
}: DateFieldProps): React.JSX.Element {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const safeValue = isValidLocalDate(value) ? value : todayLocal();
  const max = maxDate ?? todayLocal();
  const min = minDate ?? addDays(max, -3650);

  return (
    <View style={{ marginBottom: theme.spacing.md }}>
      <AppText variant="label" muted>
        {label}
      </AppText>
      <Button
        label={safeValue}
        variant="secondary"
        onPress={() => setOpen(true)}
      />
      {open && Platform.OS !== 'web' ? (
        <DateTimePicker
          value={parseLocalDate(safeValue)}
          minimumDate={parseLocalDate(min)}
          maximumDate={parseLocalDate(max)}
          mode="date"
          display="default"
          onChange={(event, selected) => {
            setOpen(false);
            if (event.type === 'set' && selected) {
              onChange(
                `${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, '0')}-${String(
                  selected.getDate(),
                ).padStart(2, '0')}`,
              );
            }
          }}
        />
      ) : null}
    </View>
  );
}

export interface TimeFieldProps {
  label: string;
  value: LocalTime;
  onChange(t: LocalTime): void;
}

/** CMP-UI-008 */
export function TimeField({ label, value, onChange }: TimeFieldProps): React.JSX.Element {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const safeTime: LocalTime = isValidLocalTime(value) ? value : '08:00';
  const [hours, minutes] = safeTime.split(':').map((part) => Number.parseInt(part, 10));
  const asDate = new Date();
  asDate.setHours(hours, minutes, 0, 0);

  return (
    <View style={{ marginBottom: theme.spacing.md }}>
      <AppText variant="label" muted>
        {label}
      </AppText>
      <Button label={safeTime} variant="secondary" onPress={() => setOpen(true)} />
      {open && Platform.OS !== 'web' ? (
        <DateTimePicker
          value={asDate}
          mode="time"
          display="default"
          onChange={(event, selected) => {
            setOpen(false);
            if (event.type === 'set' && selected) {
              onChange(
                `${String(selected.getHours()).padStart(2, '0')}:${String(
                  selected.getMinutes(),
                ).padStart(2, '0')}`,
              );
            }
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, fontSize: 16 },
});