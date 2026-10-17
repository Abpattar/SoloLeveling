/**
 * INTEGRATION CONTRACT: CMP-UI-011, CMP-UI-012, CMP-UI-013, CMP-UI-014
 * Purpose: shared feedback components. ErrorBanner shows only `error.message` — never a raw cause,
 *          a stack trace or a provider response body.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CMP-UI-011..014)
 * Consumers: every screen
 * Contract status: APPROVED
 */
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { Button } from './Button';
import { useTheme } from './theme';
import { isAppError } from '../errors/AppError';
import type { AppError } from '../errors/AppError';

export interface SectionHeaderProps {
  title: string;
  action?: { label: string; onPress(): void };
}

/** CMP-UI-011 */
export function SectionHeader({ title, action }: SectionHeaderProps): React.JSX.Element {
  const theme = useTheme();
  return (
    <View style={[styles.row, { marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm }]}>
      <AppText variant="heading" style={{ flex: 1, marginBottom: 0 }}>
        {title}
      </AppText>
      {action ? <Button label={action.label} variant="ghost" onPress={action.onPress} /> : null}
    </View>
  );
}

export interface EmptyStateProps {
  title: string;
  message?: string;
  action?: { label: string; onPress(): void };
}

/** CMP-UI-012 */
export function EmptyState({ title, message, action }: EmptyStateProps): React.JSX.Element {
  const theme = useTheme();
  return (
    <View style={[styles.center, { paddingVertical: theme.spacing.xl }]}>
      <AppText variant="heading" muted>
        {title}
      </AppText>
      {message ? (
        <AppText muted style={{ textAlign: 'center' }}>
          {message}
        </AppText>
      ) : null}
      {action ? (
        <View style={{ marginTop: theme.spacing.md, alignSelf: 'stretch' }}>
          <Button label={action.label} onPress={action.onPress} />
        </View>
      ) : null}
    </View>
  );
}

/** CMP-UI-013 */
export function LoadingView(): React.JSX.Element {
  const theme = useTheme();
  return (
    <View style={[styles.center, { paddingVertical: theme.spacing.xl }]}>
      <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Loading" />
    </View>
  );
}

export interface ErrorBannerProps {
  error: AppError | string | null;
}

/** CMP-UI-014 */
export function ErrorBanner({ error }: ErrorBannerProps): React.JSX.Element | null {
  const theme = useTheme();
  if (!error) {
    return null;
  }
  const message = typeof error === 'string' ? error : isAppError(error) ? error.message : String(error);
  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.banner,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.danger,
          borderRadius: theme.radius.sm,
          padding: theme.spacing.sm + 2,
          marginBottom: theme.spacing.sm,
        },
      ]}
    >
      <AppText style={{ color: theme.colors.danger }}>{message}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  banner: { borderWidth: 1 },
});