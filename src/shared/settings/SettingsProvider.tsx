/**
 * INTEGRATION CONTRACT: CMP-SET-001, HOOK-SET-001
 * Purpose: makes the single settings row available to the whole app, kept in sync with
 *          `settings.changed` and `data.restored` without any screen re-querying SQLite itself.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CMP-SET-001, HOOK-SET-001)
 * Consumers: reminders (A2), food (A3), nutrition-ai (A4), progress (A6), shell (A7)
 * Contract status: APPROVED
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAppEvent } from '../events/appEvents';
import { toAppError } from '../errors/AppError';
import { getSettings, updateSettings } from './settingsRepository';
import { logger } from '../utils/logger';
import type { ReactNode } from 'react';
import type { DeepPartial } from '../types/common';
import type { AppSettings } from '../types/settings';

interface SettingsContextValue {
  settings: AppSettings;
  loading: boolean;
  update: (patch: DeepPartial<AppSettings>) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

/** CMP-SET-001 */
export function SettingsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null);

  const reload = useCallback(async () => {
    try {
      setSettings(await getSettings());
    } catch (e) {
      logger.warn('Settings could not be loaded.', { error: String(toAppError(e)) });
    }
  }, []);

  useEffect(() => {
    // Loading settings once on mount is this provider's job; the setState is what renders them.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  useAppEvent('settings.changed', () => {
    void reload();
  });
  useAppEvent('data.restored', () => {
    void reload();
  });

  const update = useCallback(async (patch: DeepPartial<AppSettings>) => {
    const next = await updateSettings(patch);
    setSettings(next);
  }, []);

  const value = useMemo<SettingsContextValue | null>(
    () => (settings ? { settings, loading: false, update } : null),
    [settings, update],
  );

  if (!value) {
    return <>{null}</>;
  }
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

/** HOOK-SET-001 — throws a readable error if used outside the provider (a wiring bug, not user input). */
export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) {
    throw new Error('useSettings must be used inside SettingsProvider.');
  }
  return value;
}