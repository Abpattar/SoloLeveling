/**
 * INTEGRATION CONTRACT: CMP-UI-002
 * Purpose: the only text component; variants and the muted flag map onto theme tokens.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CMP-UI-002)
 * Consumers: every screen
 * Contract status: APPROVED
 */
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTheme } from './theme';
import type { ReactNode } from 'react';
import type { StyleProp, TextStyle } from 'react-native';

export type AppTextVariant = 'title' | 'heading' | 'body' | 'caption' | 'label';

const VARIANT_FONT_SIZE: Record<AppTextVariant, 'sm' | 'md' | 'lg' | 'xl'> = {
  title: 'xl',
  heading: 'lg',
  body: 'md',
  caption: 'sm',
  label: 'sm',
};

export interface AppTextProps {
  variant?: AppTextVariant;
  muted?: boolean;
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}

/** CMP-UI-002 */
export function AppText({
  variant = 'body',
  muted = false,
  children,
  style,
}: AppTextProps): React.JSX.Element {
  const theme = useTheme();
  const fontSize = theme.fontSize[VARIANT_FONT_SIZE[variant]];
  const fontWeight = variant === 'title' || variant === 'heading' ? '700' : '400';
  const color = muted ? theme.colors.textMuted : theme.colors.text;

  return (
    <Text style={[styles.base, { fontSize, fontWeight, color }, style]}>{children}</Text>
  );
}

const styles = StyleSheet.create({
  base: { marginBottom: 4 },
});