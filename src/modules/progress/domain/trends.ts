/**
 * INTEGRATION CONTRACT: internal (A6 progress)
 * Purpose: pure trend maths for the Progress tab. Averages only over days that actually have data, so
 *          a quiet week never drags an average toward zero.
 * Canonical definition: AGENT_06_PROMPT.md §3 (`progress/domain/trends.ts`)
 * Consumers: ProgressScreen.tsx, trends.test.ts
 * Contract status: APPROVED (internal symbol, no registry ID)
 */
// CONTRACT: API-DATE-0xx (A6 local helper) - the one ISO week key used by all trend maths
import { isoWeekKey } from '@/shared/utils/dates';
import type { LocalDate } from '@/shared/types/common';
import type { DailyNutritionTotals } from '@/shared/types/food';

export interface WeeklyNutritionAverage {
  /** ISO week key, e.g. "2026-W41". */
  key: string;
  averageCaloriesKcal: number;
  averageProteinGrams: number;
  daysCounted: number;
}

/** A day counts only when at least one entry actually carried calories. */
export function weeklyNutritionAverages(
  days: DailyNutritionTotals[],
): WeeklyNutritionAverage[] {
  const groups = new Map<string, DailyNutritionTotals[]>();
  for (const day of days) {
    if (day.total.caloriesKcal <= 0) {
      continue;
    }
    const key = isoWeekKey(day.localDate);
    const bucket = groups.get(key) ?? [];
    bucket.push(day);
    groups.set(key, bucket);
  }
  return Array.from(groups.entries())
    .map(([key, bucket]) => ({
      key,
      averageCaloriesKcal:
        Math.round(
          (bucket.reduce((total, day) => total + day.total.caloriesKcal, 0) / bucket.length) * 10,
        ) / 10,
      averageProteinGrams:
        Math.round(
          (bucket.reduce((total, day) => total + day.total.proteinGrams, 0) / bucket.length) * 10,
        ) / 10,
      daysCounted: bucket.length,
    }))
    .sort((a, b) => (a.key < b.key ? -1 : 1));
}

export interface ConsistencyWeek {
  key: string;
  completedSessions: number;
  daysWithSession: number;
}

/** Completed sessions and days-with-a-session per ISO week inside the range. */
export function exerciseConsistencyByWeek(
  countsByDate: Record<LocalDate, number>,
  from: LocalDate,
  to: LocalDate,
): ConsistencyWeek[] {
  const weeks = new Map<string, ConsistencyWeek>();
  for (const [date, count] of Object.entries(countsByDate)) {
    if (date < from || date > to) {
      continue;
    }
    if (!Number.isInteger(count) || count <= 0) {
      continue;
    }
    const key = isoWeekKey(date);
    const bucket = weeks.get(key) ?? { key, completedSessions: 0, daysWithSession: 0 };
    bucket.completedSessions += count;
    bucket.daysWithSession += 1;
    weeks.set(key, bucket);
  }
  return Array.from(weeks.values()).sort((a, b) => (a.key < b.key ? -1 : 1));
}
