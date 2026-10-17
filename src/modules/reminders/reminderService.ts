/**
 * INTEGRATION CONTRACT: API-REM-001, API-REM-002, API-REM-003, API-REM-004
 * Purpose: rebuild the whole reminder plan from current truth. Every sync cancels every `rem:`
 *          notification first and then schedules the plan, so it is idempotent and can never nag
 *          about something already done. It never throws.
 * Canonical definition: SHARED_CONTRACT.md §9, ERROR_HANDLING_AND_SECURITY §3.7
 * Consumers: src/shell/bootstrap.ts (A7)
 * Contract status: APPROVED
 */
import { AppState } from 'react-native';
import { appEvents } from '@/shared/events/appEvents';
import { getSettings } from '@/shared/settings/settingsRepository';
import { addDays, todayLocal } from '@/shared/utils/dates';
import { logger } from '@/shared/utils/logger';
// CONTRACT: API-TRN-007/014 (A2) — today's plan and completion state
import { getSessionDayStatus, listExercisesScheduledFor } from '@/modules/training';
// CONTRACT: API-FOOD-001/008 (A3) — meal categories and today's photos
import { listFoodEntriesForDate, listMealCategories } from '@/modules/food';
import {
  cancelAllManagedReminders,
  ensureChannel,
  getPermissionState,
  requestPermission,
  scheduleReminder,
  setForegroundHandler,
} from './notifications';
import { planReminders, REMINDER_WINDOW_DAYS } from './scheduler';
import type { LocalDate, Unsubscribe } from '@/shared/types/common';
import type { NotificationPermissionState } from './types';

const SYNC_DEBOUNCE_MS = 300;

let initialized = false;
let debounceHandle: ReturnType<typeof setTimeout> | null = null;
let subscriptions: Unsubscribe[] = [];

/** API-REM-003 */
export async function getNotificationPermissionState(): Promise<NotificationPermissionState> {
  return getPermissionState();
}

/** API-REM-004 */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  const state = await requestPermission();
  await ensureChannel();
  if (state === 'granted') {
    await syncReminders();
  }
  return state;
}

async function gatherExerciseDates(today: LocalDate): Promise<Set<LocalDate>> {
  const dates = new Set<LocalDate>();
  for (let offset = 0; offset < REMINDER_WINDOW_DAYS; offset += 1) {
    const date = addDays(today, offset);
    const exercises = await listExercisesScheduledFor(date);
    if (exercises.length > 0) {
      dates.add(date);
    }
  }
  return dates;
}

/** API-REM-002 */
export async function syncReminders(): Promise<void> {
  try {
    const permission = await getPermissionState();
    if (permission !== 'granted') {
      // Nothing may be scheduled without permission, and anything already scheduled must go.
      await cancelAllManagedReminders();
      return;
    }

    const settings = await getSettings();
    const today = todayLocal();
    const [categories, dayStatus, entries, exerciseDates] = await Promise.all([
      listMealCategories(),
      getSessionDayStatus(today),
      listFoodEntriesForDate(today),
      gatherExerciseDates(today),
    ]);

    const plan = planReminders({
      now: new Date(),
      settings: settings.reminders,
      mealCategories: categories.map((c) => ({ id: c.id, name: c.name })),
      exerciseDates,
      completedSessionToday: dayStatus.completedSessionCount > 0,
      loggedCategoryIdsToday: new Set(entries.map((e) => e.mealCategoryId)),
      mealPhotoCountToday: entries.length,
    });

    await cancelAllManagedReminders();
    await ensureChannel();
    for (const reminder of plan) {
      await scheduleReminder(reminder);
    }
  } catch (e) {
    // A reminder failure must never surface to the user or block the app.
    logger.warn('Reminders could not be refreshed.', { error: String(e) });
  }
}

function scheduleDebouncedSync(): void {
  if (debounceHandle !== null) {
    clearTimeout(debounceHandle);
  }
  debounceHandle = setTimeout(() => {
    debounceHandle = null;
    void syncReminders();
  }, SYNC_DEBOUNCE_MS);
}

/** API-REM-001 */
export async function initializeReminders(): Promise<void> {
  if (initialized) {
    return;
  }
  initialized = true;
  setForegroundHandler();
  await ensureChannel();

  subscriptions = [
    appEvents.on('settings.changed', scheduleDebouncedSync),
    appEvents.on('food.entry.saved', scheduleDebouncedSync),
    appEvents.on('food.entry.deleted', scheduleDebouncedSync),
    appEvents.on('session.saved', scheduleDebouncedSync),
    appEvents.on('exercises.changed', scheduleDebouncedSync),
    appEvents.on('data.restored', scheduleDebouncedSync),
  ];

  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void syncReminders();
    }
  });

  await syncReminders();
}

/** LOCAL-WORKAROUND (internal): tests need a clean slate; production never calls this. */
export function resetRemindersForTesting(): void {
  if (debounceHandle !== null) {
    clearTimeout(debounceHandle);
    debounceHandle = null;
  }
  for (const off of subscriptions) {
    off();
  }
  subscriptions = [];
  initialized = false;
}