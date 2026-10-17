/**
 * INTEGRATION CONTRACT: internal helper (A3 food)
 * Purpose: the ONE place that knows how a `food_entries` row becomes a `FoodEntry`, plus the value
 *          validation shared by the repository and the analysis service. Both import this file so
 *          there is no import cycle between them.
 * Canonical definition: DATA_MODEL_AND_STORAGE.md §3 (column <-> field mapping)
 * Consumers: foodRepository.ts, analysisService.ts, totals.ts, foodRepository.test.ts
 * Contract status: APPROVED (internal symbol, no registry ID)
 */
import { AppError } from '@/shared/errors/AppError';
import type { SqlParam } from '@/shared/db/types';
import type { AiProviderId } from '@/shared/types/settings';
import type { ClarificationQuestion } from '@/shared/types/nutritionAi';
import type {
  AnalysisStatus,
  Confidence,
  FoodEntry,
  FoodItem,
  NutritionSource,
  NutritionValues,
} from '@/shared/types/food';

export interface FoodEntryRow {
  id: string;
  meal_category_id: string;
  image_path: string;
  captured_at: string;
  local_date: string;
  note: string | null;
  description: string | null;
  foods_json: string;
  portion_text: string | null;
  calories_kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  nutrition_source: string;
  confidence: string;
  analysis_status: string;
  analysis_opt_out: number;
  analysis_provider: string | null;
  analysis_error: string | null;
  analyzed_at: string | null;
  clarification_json: string | null;
  created_at: string;
  updated_at: string;
}

/** Caps from SHARED_CONTRACT §7. A value above its cap is stored as null, never silently kept. */
export const NUTRITION_CAPS = {
  caloriesKcal: 5000,
  proteinGrams: 300,
  carbsGrams: 800,
  fatGrams: 400,
} as const;

export function clampNutritionValue(
  value: unknown,
  cap: number,
  label: string,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new AppError('VALIDATION', `${label} must be a number.`);
  }
  if (parsed < 0) {
    throw new AppError('VALIDATION', `${label} cannot be negative.`);
  }
  return parsed > cap ? null : parsed;
}

export function validateNutritionValues(values: NutritionValues): NutritionValues {
  return {
    caloriesKcal: clampNutritionValue(values.caloriesKcal, NUTRITION_CAPS.caloriesKcal, 'Calories'),
    proteinGrams: clampNutritionValue(values.proteinGrams, NUTRITION_CAPS.proteinGrams, 'Protein'),
    carbsGrams: clampNutritionValue(values.carbsGrams, NUTRITION_CAPS.carbsGrams, 'Carbs'),
    fatGrams: clampNutritionValue(values.fatGrams, NUTRITION_CAPS.fatGrams, 'Fat'),
  };
}

/** LOCAL-WORKAROUND (internal): bad JSON in a column degrades to a safe default, never throws. */
export function parseJsonColumn<T>(raw: string | null, fallback: T): T {
  if (raw === null || raw === undefined) {
    return fallback;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

function parseFoodItems(raw: string): FoodItem[] {
  const parsed = parseJsonColumn<unknown>(raw, []);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      name: typeof item.name === 'string' ? item.name : 'Item',
      portionText: typeof item.portion_text === 'string' ? item.portion_text : null,
      caloriesKcal: typeof item.calories_kcal === 'number' ? item.calories_kcal : null,
      proteinGrams: typeof item.protein_g === 'number' ? item.protein_g : null,
    }));
}

function parseClarification(raw: string | null): ClarificationQuestion | null {
  if (!raw) {
    return null;
  }
  const parsed = parseJsonColumn<ClarificationQuestion | null>(raw, null);
  if (
    !parsed ||
    typeof parsed.question !== 'string' ||
    !Array.isArray(parsed.options) ||
    parsed.options.length < 2 ||
    parsed.affects !== 'portion' &&
      parsed.affects !== 'ingredient'
  ) {
    return null;
  }
  return {
    question: parsed.question,
    options: parsed.options.filter((o): o is string => typeof o === 'string'),
    affects: parsed.affects,
  };
}

export function rowToFoodEntry(row: FoodEntryRow): FoodEntry {
  return {
    id: row.id,
    mealCategoryId: row.meal_category_id,
    imagePath: row.image_path,
    capturedAt: row.captured_at,
    localDate: row.local_date,
    note: row.note,
    description: row.description,
    foods: parseFoodItems(row.foods_json),
    portionText: row.portion_text,
    nutrition: {
      caloriesKcal: row.calories_kcal === null ? null : Number(row.calories_kcal),
      proteinGrams: row.protein_g === null ? null : Number(row.protein_g),
      carbsGrams: row.carbs_g === null ? null : Number(row.carbs_g),
      fatGrams: row.fat_g === null ? null : Number(row.fat_g),
    },
    nutritionSource: row.nutrition_source as NutritionSource,
    confidence: row.confidence as Confidence,
    analysisStatus: row.analysis_status as AnalysisStatus,
    analysisOptOut: row.analysis_opt_out === 1,
    analysisProvider: (row.analysis_provider as AiProviderId | null) ?? null,
    analysisError: row.analysis_error,
    analyzedAt: row.analyzed_at,
    pendingClarification: parseClarification(row.clarification_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** LOCAL-WORKAROUND (internal): the column list shared by every food_entries query. */
export const FOOD_ENTRY_COLUMNS =
  'id, meal_category_id, image_path, captured_at, local_date, note, description, foods_json, ' +
  'portion_text, calories_kcal, protein_g, carbs_g, fat_g, nutrition_source, confidence, ' +
  'analysis_status, analysis_opt_out, analysis_provider, analysis_error, analyzed_at, ' +
  'clarification_json, created_at, updated_at';

export function nutritionParams(values: NutritionValues): SqlParam[] {
  return [values.caloriesKcal, values.proteinGrams, values.carbsGrams, values.fatGrams];
}

export function toFoodItemsJson(items: FoodItem[]): string {
  return JSON.stringify(
    items.map((item) => ({
      name: item.name,
      portion_text: item.portionText,
      calories_kcal: item.caloriesKcal,
      protein_g: item.proteinGrams,
    })),
  );
}

export const EMPTY_NUTRITION: NutritionValues = {
  caloriesKcal: null,
  proteinGrams: null,
  carbsGrams: null,
  fatGrams: null,
};