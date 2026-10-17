/**
 * INTEGRATION CONTRACT: CMP-UI-009, CMP-UI-010
 * Purpose: small selectable chips and a segmented control, built on the shared Button/Card styling.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CMP-UI-009, CMP-UI-010)
 * Consumers: exercises, food categories, photo categories, journal swelling level
 * Contract status: APPROVED
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { useTheme } from './theme';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?(): void;
}

/** CMP-UI-009 */
export function Chip({ label, selected = false, onPress }: ChipProps): React.JSX.Element {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: selected ? theme.colors.primary : theme.colors.border,
          backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
          borderRadius: theme.radius.sm,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          marginRight: theme.spacing.sm,
          marginBottom: theme.spacing.sm,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <AppText style={{ color: selected ? theme.colors.primaryText : theme.colors.text }}>
        {label}
      </AppText>
    </Pressable>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedProps<T extends string> {
  options: Array<SegmentedOption<T>>;
  value: T;
  onChange(v: T): void;
}

/** CMP-UI-010 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: SegmentedProps<T>): React.JSX.Element {
  const theme = useTheme();
  return (
    <View style={[styles.segmented, { borderColor: theme.colors.border, borderRadius: theme.radius.md }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              {
                backgroundColor: selected ? theme.colors.primary : 'transparent',
                borderRadius: theme.radius.sm,
                paddingVertical: theme.spacing.sm,
              },
            ]}
          >
            <AppText style={{ color: selected ? theme.colors.primaryText : theme.colors.text }}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { borderWidth: 1, minHeight: 44, justifyContent: 'center' },
  segmented: { flexDirection: 'row', borderWidth: 1, overflow: 'hidden' },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
});