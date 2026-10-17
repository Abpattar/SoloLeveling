/**
 * INTEGRATION CONTRACT: internal (A3 food) — the single seam to `@/modules/nutrition-ai`
 * Purpose: keeps the legal `food → nutrition-ai` edge in ONE file. While nutrition-ai is not wired in
 *          (or when the user has not opted in), every call here reports the safe default instead of
 *          throwing, so food logging can never fail because analysis is missing.
 * Canonical definition: SHARED_CONTRACT.md §2.8 (allowed edges), §7 (consent)
 * Consumers: foodRepository.ts, analysisService.ts. Stage 4 calls `setEstimatorBridge` once.
 * Contract status: APPROVED (internal symbol, no registry ID)
 */
import { AppError } from '@/shared/errors/AppError';
import { logger } from '@/shared/utils/logger';
import type { Result } from '@/shared/types/common';
import type { AnalysisAvailability, NutritionEstimateRequest, NutritionEstimate } from '@/shared/types/nutritionAi';

export interface EstimatorBridge {
  getAnalysisAvailability(): Promise<AnalysisAvailability>;
  estimateNutritionFromImage(request: NutritionEstimateRequest): Promise<Result<NutritionEstimate>>;
}

let bridge: EstimatorBridge | null = null;

/** LOCAL-WORKAROUND (A3): called by nutrition-ai (Stage 4) at bootstrap. */
export function setEstimatorBridge(next: EstimatorBridge | null): void {
  bridge = next;
}

/** LOCAL-WORKAROUND (A3): the UI uses this to hide retry buttons that cannot work yet. */
export function isEstimatorAttached(): boolean {
  return bridge !== null;
}

/** Never throws: a missing bridge is the same as analysis being switched off. */
export async function getAnalysisAvailabilitySafe(): Promise<AnalysisAvailability> {
  if (!bridge) {
    return { state: 'disabled' };
  }
  try {
    return await bridge.getAnalysisAvailability();
  } catch (e) {
    logger.warn('Analysis availability could not be read.', { error: String(e) });
    return { state: 'disabled' };
  }
}

/**
 * Never throws: a missing bridge is `NOT_CONFIGURED`, and a bridge that rejects (a transport crash
 * the provider adapter did not already convert) is treated as `NETWORK`, which keeps the entry
 * retryable instead of losing the photo.
 */
export async function estimateNutritionFromImageSafe(
  request: NutritionEstimateRequest,
): Promise<Result<NutritionEstimate>> {
  if (!bridge) {
    return {
      ok: false,
      error: new AppError('NOT_CONFIGURED', 'Photo analysis is not set up.'),
    };
  }
  try {
    return await bridge.estimateNutritionFromImage(request);
  } catch (e) {
    logger.warn('The nutrition estimator threw instead of returning a result.', { error: String(e) });
    return {
      ok: false,
      error: new AppError('NETWORK', "Couldn't reach the analysis service.", { cause: e }),
    };
  }
}