/**
 * INTEGRATION CONTRACT: API-SET-005, API-SET-006, API-SET-007
 * Purpose: one `settings` row (key 'app') holding JSON `AppSettings`. No secrets are ever stored here.
 *          Every successful write emits `settings.changed` so reminders and the provider reload.
 * Canonical definition: SHARED_CONTRACT.md §7 (consent), SHARED_SYMBOL_REGISTRY.md (SET area)
 * Consumers: every module via getSettings/useSettings, reminders (A2), nutrition-ai (A4), shell (A7)
 * Contract status: APPROVED
 */
import { getDb } from '../db/database';
import { AppError } from '../errors/AppError';
import { DEFAULT_APP_SETTINGS } from '../constants/settings';
import { appEvents } from '../events/appEvents';
import { isValidLocalTime, nowIso } from '../utils/dates';
import { logger } from '../utils/logger';
import type { DeepPartial } from '../types/common';
import type { AiProviderId, AppSettings } from '../types/settings';

const SETTINGS_KEY = 'app';
const PROVIDER_IDS: AiProviderId[] = ['groq', 'gemini'];

interface SettingsRow {
  value: string;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * LOCAL-WORKAROUND (internal, this file): deep merge where records merge key-by-key and arrays are
 * replaced wholesale. `undefined` in the patch means "leave alone".
 */
export function mergeSettings(base: AppSettings, patch: DeepPartial<AppSettings>): AppSettings {
  const out = clone(base) as unknown as Record<string, unknown>;
  const walk = (target: Record<string, unknown>, source: Record<string, unknown>): void => {
    for (const [key, value] of Object.entries(source)) {
      if (value === undefined) {
        continue;
      }
      const current = target[key];
      if (isPlainObject(value) && isPlainObject(current)) {
        walk(current, value);
      } else if (Array.isArray(value)) {
        target[key] = value;
      } else {
        target[key] = value;
      }
    }
  };
  walk(out, patch as Record<string, unknown>);
  return out as unknown as AppSettings;
}

function validate(settings: AppSettings): void {
  const { painAlertLevel } = settings.safety;
  if (
    painAlertLevel !== null &&
    (!Number.isInteger(painAlertLevel) || painAlertLevel < 0 || painAlertLevel > 10)
  ) {
    throw new AppError('VALIDATION', 'Your symptom alert level must be a whole number from 0 to 10.');
  }
  for (const key of ['targetCaloriesKcal', 'targetProteinGrams'] as const) {
    const value = settings.nutrition[key];
    if (value !== null && (!Number.isFinite(value) || value <= 0 || value > 100000)) {
      throw new AppError('VALIDATION', 'Nutrition targets must be positive numbers.');
    }
  }
  if (!isValidLocalTime(settings.reminders.exercise.timeLocal)) {
    throw new AppError('VALIDATION', 'That reminder time is not valid.');
  }
  if (!isValidLocalTime(settings.reminders.endOfDay.timeLocal)) {
    throw new AppError('VALIDATION', 'That reminder time is not valid.');
  }
  for (const meal of Object.values(settings.reminders.meals)) {
    if (!isValidLocalTime(meal.timeLocal)) {
      throw new AppError('VALIDATION', 'That reminder time is not valid.');
    }
  }
  const { ai } = settings;
  if (ai.providerId !== null && !PROVIDER_IDS.includes(ai.providerId)) {
    throw new AppError('VALIDATION', 'Choose one of the listed analysis providers.');
  }
  if (ai.consentProviderId !== null && !PROVIDER_IDS.includes(ai.consentProviderId)) {
    throw new AppError('VALIDATION', 'Choose one of the listed analysis providers.');
  }
  if (ai.consentDisclosureVersion !== null && !Number.isInteger(ai.consentDisclosureVersion)) {
    throw new AppError('VALIDATION', 'The consent disclosure version is not valid.');
  }
  if (ai.modelOverride !== null) {
    const trimmed = ai.modelOverride.trim();
    if (trimmed.length === 0 || trimmed.length > 120) {
      throw new AppError('VALIDATION', 'The model name is not valid.');
    }
  }
}

async function readStoredValue(): Promise<string | null> {
  const db = await getDb();
  const row = await db.queryOne<SettingsRow>('SELECT value FROM settings WHERE key = ?', [SETTINGS_KEY]);
  return row?.value ?? null;
}

async function writeStoredValue(settings: AppSettings): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [SETTINGS_KEY, JSON.stringify(settings), nowIso()],
  );
}

/** API-SET-005 — stored values are merged over the defaults, so new keys appear automatically. */
export async function getSettings(): Promise<AppSettings> {
  const raw = await readStoredValue();
  if (!raw) {
    return clone(DEFAULT_APP_SETTINGS);
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainObject(parsed)) {
      return clone(DEFAULT_APP_SETTINGS);
    }
    return mergeSettings(DEFAULT_APP_SETTINGS, parsed as DeepPartial<AppSettings>);
  } catch (e) {
    logger.warn('Stored settings could not be parsed; using defaults.', { error: String(e) });
    return clone(DEFAULT_APP_SETTINGS);
  }
}

/** API-SET-006 — validates first and writes nothing on failure. Emits EVT-SET-001. */
export async function updateSettings(patch: DeepPartial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const next = mergeSettings(current, patch);
  validate(next);
  await writeStoredValue(next);
  appEvents.emit('settings.changed', { keys: Object.keys(patch as Record<string, unknown>) });
  return next;
}

/** API-SET-007 — used when a restore happens; consent must never survive a data import. */
export async function resetAiConsent(): Promise<AppSettings> {
  return updateSettings({ ai: clone(DEFAULT_APP_SETTINGS.ai) });
}