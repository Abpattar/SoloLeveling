/**
 * INTEGRATION CONTRACT: TYPE-FOOD-001 .. TYPE-FOOD-011
 * Purpose: meal categories, photo food entries, nutrition values and derived daily totals.
 * Canonical definition: SHARED_CONTRACT.md §3.6
 * Consumers: food (A3), nutrition-ai (A4), reminders (A2), progress (A6)
 * Contract status: APPROVED
 */
import type { Id, IsoDateTime, LocalDate } from './common';
import type { AiProviderId } from './settings';
import type { ClarificationQuestion } from './nutritionAi';

export interface MealCategory {
  id: Id;
  name: string;
  isDefault: boolean;
  sortOrder: number;
  archivedAt: IsoDateTime | null;
}

export type NutritionSource = 'none' | 'ai_estimate' | 'confirmed' | 'manual' | 'unknown';
export type Confidence = 'unknown' | 'low' | 'medium' | 'high';

export type AnalysisStatus =
  | 'not_requested'
  | 'pending'
  | 'in_progress'
  | 'succeeded'
  | 'failed'
  | 'skipped_by_user';

export interface NutritionValues {
  caloriesKcal: number | null;
  proteinGrams: number | null;
  carbsGrams: number | null;
  fatGrams: number | null;
}

export interface NutritionTotals {
  caloriesKcal: number;
  proteinGrams: number;
  carbsGrams: number | null; // null when no entry supplied a value
  fatGrams: number | null;
}

export interface FoodItem {
  name: string;
  portionText: string | null;
  caloriesKcal: number | null;
  proteinGrams: number | null;
}

export interface FoodEntry {
  id: Id;
  mealCategoryId: Id;
  imagePath: string; // RELATIVE path under the private photo root, e.g. "food/<id>.jpg"
  capturedAt: IsoDateTime;
  localDate: LocalDate;
  note: string | null;
  description: string | null; // detected/confirmed foods in words
  foods: FoodItem[];
  portionText: string | null;
  nutrition: NutritionValues;
  nutritionSource: NutritionSource; // 'ai_estimate' = unconfirmed AI; 'confirmed' = user-approved (maybe edited) AI result
  confidence: Confidence;
  analysisStatus: AnalysisStatus;
  analysisOptOut: boolean; // per-photo "do not send"
  analysisProvider: AiProviderId | null;
  analysisError: string | null;
  analyzedAt: IsoDateTime | null;
  pendingClarification: ClarificationQuestion | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface CreateFoodEntryInput {
  mealCategoryId: Id;
  tempImageUri: string; // camera output; copied into private storage, temp deleted
  capturedAt?: IsoDateTime; // default now; must not be in the future
  note?: string | null;
  analysisOptOut?: boolean;
}

export interface FoodEntryDetailsPatch {
  mealCategoryId?: Id;
  note?: string | null;
  description?: string | null;
  portionText?: string | null;
  foods?: FoodItem[];
  capturedAt?: IsoDateTime;
}

export interface DailyNutritionTotals {
  localDate: LocalDate;
  total: NutritionTotals; // sums ai_estimate + confirmed + manual entries only
  bySource: Record<'ai_estimate' | 'confirmed' | 'manual', NutritionTotals>;
  mealSubtotals: Array<{ mealCategoryId: Id; entryCount: number; total: NutritionTotals }>;
  entryCount: number;
  entriesWithoutValues: number; // none/unknown source or null calories
}