/**
 * INTEGRATION CONTRACT: TYPE-AI-001 .. TYPE-AI-006
 * Purpose: request/response shapes for optional AI nutrition estimation from a meal photo.
 * Canonical definition: SHARED_CONTRACT.md §3.7
 * Consumers: nutrition-ai (A4), food (A3)
 * Contract status: APPROVED
 */
import type { Confidence, NutritionValues } from './food';
import type { AiProviderId } from './settings';

export interface ClarificationQuestion {
  question: string;
  options: string[];
  affects: 'portion' | 'ingredient';
}

export interface EstimatedFoodItem {
  name: string;
  portionText: string | null;
  caloriesKcal: number | null;
  proteinGrams: number | null;
}

export interface NutritionEstimateRequest {
  imageUri: string; // MUST be a private FOOD photo (under photo root "food/"); progress photos are rejected
  mealCategoryName?: string;
  userNote?: string;
  clarification?: { question: string; answer: string };
  signal?: AbortSignal;
}

export interface NutritionEstimate {
  description: string;
  items: EstimatedFoodItem[];
  portionText: string | null;
  nutrition: NutritionValues;
  confidence: Confidence;
  clarification: ClarificationQuestion | null;
  providerId: AiProviderId;
  modelId: string;
  notFood: boolean; // true => items empty, nutrition all null
}

export type AnalysisAvailability =
  | { state: 'ready'; providerId: AiProviderId }
  | { state: 'disabled' | 'no_provider' | 'no_consent' | 'no_api_key' };

export interface AiProviderInfo {
  id: AiProviderId;
  displayName: string;
  freeTierSummary: string;
  dataHandlingSummary: string;
  disclosureVersion: number;
  docsUrl: string;
  apiKeyUrl: string;
  defaultModelId: string;
  verifiedOn: string;
}