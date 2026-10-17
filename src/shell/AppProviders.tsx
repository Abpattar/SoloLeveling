/**
 * INTEGRATION CONTRACT: CMP-SHELL-001
 * Purpose: the provider stack and the startup gate. Children do not mount until the database is
 *          open and settings are loaded, because every screen reads both on mount.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CMP-SHELL-001)
 * Consumers: src/app/_layout.tsx
 * Contract status: APPROVED
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// CONTRACT: CMP-SET-001 (A1) - the single settings row, shared by every screen
import { SettingsProvider } from '@/shared/settings/SettingsProvider';
// CONTRACT: API-CORE-002 (A1) - converts anything thrown into a readable message
import { toAppError } from '@/shared/errors/AppError';
// CONTRACT: CMP-UI-013/014 (A1) - loading and failure surfaces
import { ErrorBanner, LoadingView } from '@/shared/ui/feedback';
import { Button } from '@/shared/ui/Button';
import { AppText } from '@/shared/ui/AppText';
// API-SHELL-001 (A7 self) - the startup sequence
import { bootstrapApp } from './bootstrap';
import type { ReactNode } from 'react';
import type { AppError } from '@/shared/errors/AppError';

export function AppProviders({ children }: { children: ReactNode }): React.JSX.Element {
  const [attempt, setAttempt] = useState(0);
  // The outcome is tagged with the attempt that produced it, so a retry never shows stale state and
  // nothing has to be reset synchronously inside the effect.
  const [outcome, setOutcome] = useState<{ attempt: number; error: AppError | null }>({
    attempt: 0,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    void bootstrapApp()
      .then(() => {
        if (!cancelled) {
          setOutcome({ attempt, error: null });
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setOutcome({ attempt, error: toAppError(e) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setAttempt((n) => n + 1);
  }, []);

  const current = outcome.attempt === attempt ? outcome : null;
  const error = current?.error ?? null;
  const ready = current !== null && error === null;

  return (
    <SafeAreaProvider>
      {error ? (
        <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
          <AppText variant="heading">The app could not start</AppText>
          <ErrorBanner error={error} />
          <Button label="Try again" onPress={retry} />
        </View>
      ) : ready ? (
        <SettingsProvider>{children}</SettingsProvider>
      ) : (
        <LoadingView />
      )}
    </SafeAreaProvider>
  );
}
