/**
 * INTEGRATION CONTRACT: CMP-UI-001
 * Purpose: standard screen chrome (safe area, optional scroll, optional padding) for every screen.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CMP-UI-001)
 * Consumers: every screen
 * Contract status: APPROVED
 */
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from './theme';
import type { ReactNode } from 'react';

export interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
}

/** CMP-UI-001 */
export function Screen({ children, scroll = true, padded = true }: ScreenProps): React.JSX.Element {
  const theme = useTheme();
  const contentStyle = [styles.content, padded && { padding: theme.spacing.md }];

  return (
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
      style={[styles.safe, { backgroundColor: theme.colors.background }]}
    >
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={contentStyle}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { flexGrow: 1 },
});