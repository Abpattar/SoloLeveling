/**
 * INTEGRATION CONTRACT: API-FOOD-017, API-FOOD-018
 * Purpose: daily and ranged nutrition totals, always computed from stored facts. Only
 *          `ai_estimate`, `confirmed` and `manual` entries count; anything else is reported as
 *          "entries without values" so nothing is silently dropped from the picture.
 * Canonical definition: DATA_MODEL_AND_STORAGE.md §4, SHARED_SYMBOL_REGISTRY.md (API-FOOD-017/018)
 * Consumers: food screens (A3), progress (A6), DailySummary (A6)
 * Contract status: APPROVED
 */
import { AppError } from '@/shared/errors/AppError';
import { isValidLocalDate } from '@/shared/utils/dates';
import { listFoodRowsForDate, isCountedSource } from '../data/foodRepository';
import { rowToFoodEntry } from '../data/foodRows';
import { sumNutrition } from './nutritionMath';
import type { DailyNutritionTotals, NutritionTotals, NutritionValues } from '@/shared/types/food';
import type { LocalDate } from '@/shared/types/common';

const SOURCES = ['ai_estimate', 'confirmed', 'manual'] as const;

type CountedSource = (typeof SOURCES)[number];

function emptyTotals(): NutritionTotals {
  return { caloriesKcal: 0, proteinGrams: 0, carbsGrams: null, fatGrams: null };
}

/** API-FOOD-017 */
export async function getDailyNutritionTotals(date: LocalDate): Promise<DailyNutritionTotals> {
  if (!isValidLocalDate(date)) {
    throw new AppError('VALIDATION', 'That date is not valid.');
  }
  const rows = await listFoodRowsForDate(date);
  const entries = rows.map(rowToFoodEntry);

  const bySource: Record<CountedSource, NutritionTotals> = {
    ai_estimate: emptyTotals(),
    confirmed: emptyTotals(),
    manual: emptyTotals(),
  };
  const counted: Array<{ source: CountedSource; values: NutritionValues }> = [];
  const byMeal = new Map<string, { entryCount: number; values: NutritionValues[] }>();
  let entriesWithoutValues = 0;

  for (const entry of entries) {
    const hasCalories = entry.nutrition.caloriesKcal !== null;
    if (!isCountedSource(entry.nutritionSource) || !hasCalories) {
      entriesWithoutValues += 1;
      continue;
    }
    const source = entry.nutritionSource as CountedSource;
    counted.push({ source, values: entry.nutrition });
    const bucket = byMeal.get(entry.mealCategoryId) ?? { entryCount: 0, values: [] };
    bucket.entryCount += 1;
    bucket.values.push(entry.nutrition);
    byMeal.set(entry.mealCategoryId, bucket);
  }

  for (const source of SOURCES) {
    bySource[source] = sumNutrition(counted.filter((c) => c.source === source).map((c) => c.values));
  }

  const mealSubtotals = Array.from(byMeal.entries()).map(([mealCategoryId, bucket]) => ({
    mealCategoryId,
    entryCount: bucket.entryCount,
    total: sumNutrition(bucket.values),
  }));

  return {
    localDate: date,
    total: sumNutrition(counted.map((c) => c.values)),
    bySource,
    mealSubtotals,
    entryCount: entries.length,
    entriesWithoutValues,
  };
}

/** API-FOOD-018 — one element per date, empty days included. */
export async function getNutritionTotalsForRange(
  from: LocalDate,
  to: LocalDate,
): Promise<DailyNutritionTotals[]> {
  if (!isValidLocalDate(from) || !isValidLocalDate(to)) {
    throw new AppError('VALIDATION', 'That date is not valid.');
  }
  if (from > to) {
    throw new AppError('VALIDATION', 'The start date must not be after the end date.');
  }
  const days: LocalDate[] = [];
  for (let date = from; date <= to; date = nextDay(date)) {
    days.push(date);
  }
  return Promise.all(days.map((day) => getDailyNutritionTotals(day)));
}

/** LOCAL-WORKAROUND (internal): ISO-string day stepping, DST-safe, no Date subtraction. */
function nextDay(date: LocalDate): LocalDate {
  const [year, month, day] = date.split('-').map((part) => Number.parseInt(part, 10));
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const pad = (n: number): string => (n < 10 ? `0${n}` : String(n));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}