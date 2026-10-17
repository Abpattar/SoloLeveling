/**
 * INTEGRATION CONTRACT: API-FOOD-019, API-FOOD-020
 * Purpose: the pure nutrition arithmetic. Sums skip null calories; a macro stays null unless at least
 *          one entry supplied it. Scaling rounds to whole kcal and one decimal place for grams, so
 *          the UI can never show false precision.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (API-FOOD-019/020), ERROR_HANDLING SAF-05
 * Consumers: totals.ts, analysisService.ts, foodRepository.ts
 * Contract status: APPROVED
 */
import { NUTRITION_CAPS } from '../data/foodRows';
import type { NutritionTotals, NutritionValues } from '@/shared/types/food';

/** API-FOOD-019 */
export function sumNutrition(values: NutritionValues[]): NutritionTotals {
  let calories = 0;
  let protein = 0;
  let carbsSum = 0;
  let carbsSeen = false;
  let fatSum = 0;
  let fatSeen = false;

  for (const entry of values) {
    calories += entry.caloriesKcal ?? 0;
    protein += entry.proteinGrams ?? 0;
    if (entry.carbsGrams !== null && entry.carbsGrams !== undefined) {
      carbsSum += entry.carbsGrams;
      carbsSeen = true;
    }
    if (entry.fatGrams !== null && entry.fatGrams !== undefined) {
      fatSum += entry.fatGrams;
      fatSeen = true;
    }
  }

  return {
    caloriesKcal: calories,
    proteinGrams: protein,
    carbsGrams: carbsSeen ? carbsSum : null,
    fatGrams: fatSeen ? fatSum : null,
  };
}

function scaleCalories(value: number, factor: number): number {
  return Math.min(NUTRITION_CAPS.caloriesKcal, Math.round(value * factor));
}

function scaleGrams(value: number, factor: number, cap: number): number {
  const scaled = Math.round(value * factor * 10) / 10;
  return Math.min(cap, scaled);
}

/** API-FOOD-020 — nulls stay null; kcal to whole numbers, grams to one decimal. */
export function scaleNutrition(values: NutritionValues, factor: number): NutritionValues {
  return {
    caloriesKcal:
      values.caloriesKcal === null
        ? null
        : scaleCalories(values.caloriesKcal, factor),
    proteinGrams:
      values.proteinGrams === null
        ? null
        : scaleGrams(values.proteinGrams, factor, NUTRITION_CAPS.proteinGrams),
    carbsGrams:
      values.carbsGrams === null
        ? null
        : scaleGrams(values.carbsGrams, factor, NUTRITION_CAPS.carbsGrams),
    fatGrams:
      values.fatGrams === null
        ? null
        : scaleGrams(values.fatGrams, factor, NUTRITION_CAPS.fatGrams),
  };
}