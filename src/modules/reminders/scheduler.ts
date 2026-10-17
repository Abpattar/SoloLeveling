/**
 * INTEGRATION CONTRACT: internal (A2 reminders)
 * Purpose: PURE reminder planning. Given the current time, the settings and what is already known
 *          about today, it returns exactly which notifications should exist in the next 7 local days.
 *          No I/O, no Expo, no clock reads — which is why it can be unit-tested (GAT-006, GAT-007).
 * Canonical definition: SHARED_CONTRACT.md §9, AGENT_02_PROMPT.md §5
 * Consumers: reminderService.ts, scheduler.test.ts
 * Contract status: APPROVED (internal symbol, no registry ID)
 */
import { ROUTES } from '@/shared/navigation/routes';
import { addDays, combineLocalDateTime, todayLocal } from '@/shared/utils/dates';
import type { LocalDate } from '@/shared/types/common';
import type { RemindersSettings } from '@/shared/types/settings';
import type { PlannedReminder } from './types';

export const REMINDER_TITLE = 'Recovery & Fitness';
export const REMINDER_WINDOW_DAYS = 7;

export interface PlanRemindersInput {
  now: Date;
  settings: RemindersSettings;
  mealCategories: Array<{ id: string; name: string }>;
  /** Local dates inside the window that have at least one active scheduled exercise. */
  exerciseDates: Set<LocalDate>;
  completedSessionToday: boolean;
  loggedCategoryIdsToday: Set<string>;
  mealPhotoCountToday: number;
  days?: number;
}

function exerciseIdentifier(date: LocalDate): string {
  return `rem:exercise:${date}`;
}

function mealIdentifier(mealCategoryId: string, date: LocalDate): string {
  return `rem:meal:${mealCategoryId}:${date}`;
}

function endOfDayIdentifier(date: LocalDate): string {
  return `rem:eod:${date}`;
}

function endOfDayBody(input: PlanRemindersInput, date: LocalDate, today: LocalDate): string {
  if (date !== today) {
    return 'Open the app to review your day';
  }
  const meals = `${input.mealPhotoCountToday} meal photo${input.mealPhotoCountToday === 1 ? '' : 's'} logged`;
  let exercise: string;
  if (!input.exerciseDates.has(date)) {
    exercise = 'none scheduled';
  } else if (input.completedSessionToday) {
    exercise = 'done';
  } else {
    exercise = 'not done today';
  }
  return `${meals} · exercise: ${exercise}`;
}

function buildExerciseReminders(input: PlanRemindersInput, dates: LocalDate[]): PlannedReminder[] {
  if (!input.settings.exercise.enabled) {
    return [];
  }
  const today = todayLocal(input.now);
  return dates
    .filter((date) => input.exerciseDates.has(date))
    .filter((date) => !(date === today && input.completedSessionToday))
    .map((date) => ({
      identifier: exerciseIdentifier(date),
      fireAt: combineLocalDateTime(date, input.settings.exercise.timeLocal),
      title: REMINDER_TITLE,
      body: 'It is time for today’s exercises',
      route: ROUTES.today,
    }));
}

function buildMealReminders(input: PlanRemindersInput, dates: LocalDate[]): PlannedReminder[] {
  const today = todayLocal(input.now);
  const out: PlannedReminder[] = [];
  for (const date of dates) {
    for (const category of input.mealCategories) {
      const setting = input.settings.meals[category.id];
      if (!setting || !setting.enabled) {
        continue;
      }
      if (date === today && input.loggedCategoryIdsToday.has(category.id)) {
        continue;
      }
      out.push({
        identifier: mealIdentifier(category.id, date),
        fireAt: combineLocalDateTime(date, setting.timeLocal),
        title: REMINDER_TITLE,
        body: `Take a photo of your ${category.name.toLowerCase()}`,
        route: ROUTES.foodCapture(category.id),
      });
    }
  }
  return out;
}

function buildEndOfDayReminders(input: PlanRemindersInput, dates: LocalDate[]): PlannedReminder[] {
  const setting = input.settings.endOfDay;
  if (!setting.enabled) {
    return [];
  }
  const today = todayLocal(input.now);
  return dates.map((date) => ({
    identifier: endOfDayIdentifier(date),
    fireAt: combineLocalDateTime(date, setting.timeLocal),
    title: REMINDER_TITLE,
    body: endOfDayBody(input, date, today),
    route: ROUTES.dailySummary(date),
  }));
}

/**
 * Returns the reminders that SHOULD be scheduled, sorted by fire time. Anything whose time has
 * already passed today is dropped, so re-running the planner never produces a past notification.
 */
export function planReminders(input: PlanRemindersInput): PlannedReminder[] {
  const today = todayLocal(input.now);
  const span = input.days ?? REMINDER_WINDOW_DAYS;
  const dates: LocalDate[] = [];
  for (let offset = 0; offset < span; offset += 1) {
    dates.push(addDays(today, offset));
  }

  const all = [
    ...buildExerciseReminders(input, dates),
    ...buildMealReminders(input, dates),
    ...buildEndOfDayReminders(input, dates),
  ];

  const seen = new Set<string>();
  return all
    .filter((reminder) => reminder.fireAt.getTime() > input.now.getTime())
    .filter((reminder) => {
      if (seen.has(reminder.identifier)) {
        return false;
      }
      seen.add(reminder.identifier);
      return true;
    })
    .sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
}