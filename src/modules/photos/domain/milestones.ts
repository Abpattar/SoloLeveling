/**
 * INTEGRATION CONTRACT: CONST-PHOTO-001, CONST-PHOTO-002, API-PHOTO-014, API-PHOTO-015,
 *                       API-PHOTO-016, API-PHOTO-017
 * Purpose: the whole milestone rule set as PURE functions. Nothing here reads the database or the
 *          clock, which is why the lock behaviour can be trusted and fully unit-tested.
 * Canonical definition: SHARED_CONTRACT.md §10 (milestone & journey rules)
 * Consumers: photoViews.ts, journeyRepository.ts, photoRepository.ts, screens
 * Contract status: APPROVED
 */
import { addDays, diffCalendarDays } from '@/shared/utils/dates';
import type { LocalDate } from '@/shared/types/common';
import type { MilestoneDay } from '@/shared/types/photos';

/** CONST-PHOTO-001 */
export const MILESTONE_DAYS: readonly [30, 60, 90] = [30, 60, 90];

/** CONST-PHOTO-002 */
export const DEFAULT_TIMELINE_DAYS: readonly number[] = [1, 10, 30, 60, 90];

function isMilestoneDay(day: number): day is MilestoneDay {
  return MILESTONE_DAYS.includes(day as MilestoneDay);
}

/** API-PHOTO-014 — Day 30 is start + 29 days (day N = start + N-1). */
export function getMilestoneUnlockDate(startDate: LocalDate, day: MilestoneDay): LocalDate {
  if (!isMilestoneDay(day)) {
    throw new Error(`Only Day ${MILESTONE_DAYS.join(', ')} are milestones.`);
  }
  return addDays(startDate, day - 1);
}

/**
 * API-PHOTO-015 — the smallest milestone at or after this day number.
 * A photo taken at or before Day 90 locks; a photo taken after Day 90 is never locked (null).
 */
export function getUnlockMilestoneForDay(dayNumber: number): MilestoneDay | null {
  if (!Number.isFinite(dayNumber) || dayNumber > 90) {
    return null;
  }
  for (const day of MILESTONE_DAYS) {
    if (dayNumber <= day) {
      return day;
    }
  }
  return null;
}

/** API-PHOTO-016 — unlocked by date, or by an explicit early unlock row. */
export function isMilestoneUnlocked(p: {
  startDate: LocalDate;
  today: LocalDate;
  day: MilestoneDay;
  earlyUnlockedDays: MilestoneDay[];
}): boolean {
  if (p.earlyUnlockedDays.includes(p.day)) {
    return true;
  }
  return diffCalendarDays(getMilestoneUnlockDate(p.startDate, p.day), p.today) >= 0;
}

/** API-PHOTO-017 — the smallest milestone that is not yet unlocked, or null when all are. */
export function getNextPendingMilestone(p: {
  startDate: LocalDate;
  today: LocalDate;
  earlyUnlockedDays: MilestoneDay[];
}): MilestoneDay | null {
  for (const day of MILESTONE_DAYS) {
    if (!isMilestoneUnlocked({ ...p, day })) {
      return day;
    }
  }
  return null;
}

/**
 * INTERNAL-WORKAROUND (A5): the day number of a capture date within a journey.
 * `getDayNumber` from shared already defines this; re-exported here so every photo rule reads from
 * one place.
 */
export { getDayNumber } from '@/shared/utils/dates';