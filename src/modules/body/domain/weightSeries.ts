/**
 * INTEGRATION CONTRACT: internal (A6 body)
 * Purpose: pure trend maths for measurements. It computes averages and differences; it never says
 *          what they mean. Nothing here interprets a change as recovery or as a health outcome.
 * Canonical definition: DATA_MODEL_AND_STORAGE.md §4 (weight trend), ERROR_HANDLING SAF-07
 * Consumers: MeasurementsScreen.tsx, ProgressScreen.tsx, weightSeries.test.ts
 * Contract status: APPROVED (internal symbol, no registry ID)
 */
// CONTRACT: API-DATE-0xx (A6 local helper) - the one ISO week key used by all trend maths
import { addDays, diffCalendarDays, isoWeekKey } from '@/shared/utils/dates';
import type { LocalDate } from '@/shared/types/common';
import type { WeightPoint } from '@/shared/types/body';

/**
 * Trailing average over the points whose date falls inside the window ending at each point.
 * Gaps are handled by dates, not by index, so a missing day lowers the average instead of
 * silently shifting it.
 */
export function movingAverage(
  points: WeightPoint[],
  windowDays = 7,
): Array<{ localDate: LocalDate; valueKg: number }> {
  const sorted = [...points].sort((a, b) => (a.localDate < b.localDate ? -1 : 1));
  return sorted.map((point, index) => {
    const from = addDays(point.localDate, -(windowDays - 1));
    const window = sorted.filter(
      (candidate, candidateIndex) =>
        candidateIndex <= index && diffCalendarDays(candidate.localDate, point.localDate) < windowDays &&
        candidate.localDate >= from,
    );
    const sum = window.reduce((total, candidate) => total + candidate.valueKg, 0);
    return { localDate: point.localDate, valueKg: Math.round((sum / window.length) * 100) / 100 };
  });
}

/**
 * Change from a baseline. Uses the profile baseline when there is one, otherwise the first recorded
 * point. Returns null when there is nothing to compare against.
 */
export function changeFromBaseline(
  points: WeightPoint[],
  baselineKg: number | null,
  referenceDate?: LocalDate,
): number | null {
  const sorted = [...points].sort((a, b) => (a.localDate < b.localDate ? -1 : 1));
  if (sorted.length === 0) {
    return null;
  }
  const reference =
    referenceDate === undefined
      ? (sorted[sorted.length - 1] as WeightPoint)
      : sorted.filter((point) => point.localDate <= referenceDate).pop() ??
        (sorted[0] as WeightPoint);
  const baseline = baselineKg ?? (sorted[0] as WeightPoint).valueKg;
  return Math.round((reference.valueKg - baseline) * 100) / 100;
}

export function weeklyAverages(
  points: WeightPoint[],
): Array<{ key: string; averageKg: number; count: number }> {
  return groupAverages(points, isoWeekKey);
}

export function monthlyAverages(
  points: WeightPoint[],
): Array<{ key: string; averageKg: number; count: number }> {
  return groupAverages(points, (date) => date.slice(0, 7));
}

function groupAverages(
  points: WeightPoint[],
  keyOf: (date: LocalDate) => string,
): Array<{ key: string; averageKg: number; count: number }> {
  const groups = new Map<string, number[]>();
  for (const point of points) {
    const key = keyOf(point.localDate);
    const bucket = groups.get(key) ?? [];
    bucket.push(point.valueKg);
    groups.set(key, bucket);
  }
  return Array.from(groups.entries())
    .map(([key, values]) => ({
      key,
      averageKg:
        Math.round((values.reduce((total, value) => total + value, 0) / values.length) * 100) / 100,
      count: values.length,
    }))
    .sort((a, b) => (a.key < b.key ? -1 : 1));
}
