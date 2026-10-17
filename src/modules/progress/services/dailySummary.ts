/**
 * INTEGRATION CONTRACT: API-PRG-001
 * Purpose: everything shown for one calendar day, assembled on read. The workout-calorie figure is
 *          reported on its own line and is NEVER combined with food intake (SAF-06, GAT-030).
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (API-PRG-001), DATA_MODEL_AND_STORAGE §4
 * Consumers: DailySummaryScreen.tsx (A6), Today card (A7 via A6)
 * Contract status: APPROVED
 */
import { getSettings } from '@/shared/settings/settingsRepository';
// CONTRACT: API-UNIT-005 (A1) — the only place units are converted
import { toKg } from '@/shared/utils/units';
import { AppError } from '@/shared/errors/AppError';
import { isValidLocalDate } from '@/shared/utils/dates';
// CONTRACT: API-TRN-007/011/015 (A2) — plan and sessions
import { getCompletedSessionCountsByDate, listExercisesScheduledFor, listSessionsForDate } from '@/modules/training';
// CONTRACT: API-FOOD-017 (A3) — day totals
import { getDailyNutritionTotals } from '@/modules/food';
// CONTRACT: API-BODY-004/005 (A6 self)
import { getWeightSeriesKg, listMeasurements } from '@/modules/body';
// CONTRACT: API-JRN-005 (A6 self)
import { getJournalEntriesForDate } from '@/modules/journal';
import type { DailySummary } from '@/shared/types/summary';
import type { LocalDate } from '@/shared/types/common';

/** API-PRG-001 */
export async function getDailySummary(date: LocalDate): Promise<DailySummary> {
  if (!isValidLocalDate(date)) {
    throw new AppError('VALIDATION', 'That date is not valid.');
  }

  const settings = await getSettings();
  const [nutrition, scheduled, sessions, measurements, journalEntries] = await Promise.all([
    getDailyNutritionTotals(date),
    listExercisesScheduledFor(date),
    listSessionsForDate(date),
    listMeasurements({ from: date, to: date }),
    getJournalEntriesForDate(date),
  ]);

  // The latest weight of THAT day only, in kg. Nothing is carried over from another day.
  const weights = measurements.filter((m) => m.type === 'weight');
  let weightKg: number | null = null;
  for (const measurement of weights) {
    const kg = toKg(measurement.value, measurement.unit);
    if (kg !== null && kg > 0) {
      weightKg = kg;
    }
  }

  // Workout calories are a separate, rough figure. They are never added to or subtracted from
  // `nutrition`, and they are null unless at least one completed session had a value.
  let estimatedWorkoutKcal: number | null = null;
  for (const session of sessions) {
    if (session.status !== 'completed' || session.estimatedKcal === null) {
      continue;
    }
    estimatedWorkoutKcal = (estimatedWorkoutKcal ?? 0) + session.estimatedKcal;
  }

  return {
    localDate: date,
    nutrition,
    targets: {
      caloriesKcal: settings.nutrition.targetCaloriesKcal,
      proteinGrams: settings.nutrition.targetProteinGrams,
    },
    scheduledExerciseCount: scheduled.length,
    sessions,
    estimatedWorkoutKcal,
    weightKg,
    measurements,
    journalEntries,
  };
}

/**
 * LOCAL-WORKAROUND (A6): the Progress tab needs the weight series for a range, plus the completed
 * session counts for the same range, without re-implementing either query.
 */
export async function getProgressInputs(
  from: LocalDate,
  to: LocalDate,
): Promise<{ weightSeries: Awaited<ReturnType<typeof getWeightSeriesKg>>; completedByDate: Record<LocalDate, number> }> {
  const [weightSeries, completedByDate] = await Promise.all([
    getWeightSeriesKg({ from, to }),
    getCompletedSessionCountsByDate(from, to),
  ]);
  return { weightSeries, completedByDate };
}