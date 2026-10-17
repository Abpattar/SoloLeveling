/**
 * INTEGRATION CONTRACT: CMP-UI-003
 * Purpose: the only button. Touch target is always at least 44 px and every button has an
 *          accessibility role and label.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CMP-UI-003)
 * Consumers: every screen
 * Contract status: APPROVED
 */
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { useTheme } from './theme';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export interface ButtonProps {
  label: string;
  onPress(): void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
}

/** CMP-UI-003 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
}: ButtonProps): React.JSX.Element {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const palette: Record<ButtonVariant, { background: string; text: string; border: string }> = {
    primary: {
      background: theme.colors.primary,
      text: theme.colors.primaryText,
      border: theme.colors.primary,
    },
    secondary: {
      background: 'transparent',
      text: theme.colors.primary,
      border: theme.colors.border,
    },
    danger: {
      background: theme.colors.danger,
      text: theme.colors.primaryText,
      border: theme.colors.danger,
    },
    ghost: {
      background: 'transparent',
      text: theme.colors.textMuted,
      border: 'transparent',
    },
  };
  const colors = palette[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: colors.background,
          borderColor: colors.border,
          borderRadius: theme.radius.md,
          paddingVertical: theme.spacing.sm + 4,
          paddingHorizontal: theme.spacing.md,
          opacity: isDisabled ? 0.5 : pressed ? 0.8 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <AppText style={{ color: colors.text, fontWeight: '600' }}>{label}</AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});