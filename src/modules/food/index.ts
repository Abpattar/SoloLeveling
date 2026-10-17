/**
 * INTEGRATION CONTRACT: module index for `@/modules/food`
 * Purpose: the ONLY public surface of the food module.
 * Consumers: src/app/**, src/shell/** (A7); reminders and progress via allowed edges only
 * Contract status: APPROVED
 */

// API-FOOD-001..005
export {
  archiveMealCategory,
  createMealCategory,
  listMealCategories,
  renameMealCategory,
  reorderMealCategories,
} from './data/mealCategoryRepository';

// API-FOOD-006..014
export {
  confirmAiEstimate,
  createFoodEntryFromPhoto,
  deleteFoodEntry,
  getFoodEntry,
  isAnalysisWired,
  listFoodEntriesForDate,
  markNutritionUnknown,
  saveManualNutrition,
  scaleEntryPortion,
  updateFoodEntryDetails,
} from './data/foodRepository';

// API-FOOD-015/016
export { analyzeFoodEntry, processPendingAnalyses } from './services/analysisService';

// API-FOOD-017..020
export { getDailyNutritionTotals, getNutritionTotalsForRange } from './domain/totals';
export { scaleNutrition, sumNutrition } from './domain/nutritionMath';

// internal wiring used by the shell at bootstrap (Stage 4 calls setEstimatorBridge)
export { setEstimatorBridge } from './services/estimatorBridge';

// CMP-FOOD-001..006
export { FoodLogScreen } from './screens/FoodLogScreen';
export { FoodCaptureScreen } from './screens/FoodCaptureScreen';
export { FoodEntryScreen } from './screens/FoodEntryScreen';
export { MealCategoriesScreen } from './screens/MealCategoriesScreen';
export { TodayFoodCard } from './components/TodayFoodCard';
export { NutritionTargetsSettingsSection } from './components/NutritionTargetsSettingsSection';