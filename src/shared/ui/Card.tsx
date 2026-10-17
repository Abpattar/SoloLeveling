/**
 * INTEGRATION CONTRACT: CMP-UI-004
 * Purpose: standard content container; optional `onPress` turns it into an accessible tappable card.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CMP-UI-004)
 * Consumers: every screen
 * Contract status: APPROVED
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from './theme';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export interface CardProps {
  children: ReactNode;
  onPress?(): void;
  style?: StyleProp<ViewStyle>;
}

/** CMP-UI-004 */
export function Card({ children, onPress, style }: CardProps): React.JSX.Element {
  const theme = useTheme();
  const base: StyleProp<ViewStyle> = [
    styles.base,
    {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    style,
  ];

  if (!onPress) {
    return <View style={base}>{children}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [base, pressed ? { opacity: 0.85 } : null]}
      onPress={onPress}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: 1 },
});