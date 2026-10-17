/**
 * INTEGRATION CONTRACT: API-AI-002
 * Purpose: turns a private meal photo into a validated, clearly-approximate estimate. It refuses
 *          anything that is not a private `food/` photo (so a progress photo can never be sent),
 *          re-checks consent before the request, and returns a `Result` instead of throwing.
 * Canonical definition: SHARED_CONTRACT.md §7 steps 1–5
 * Consumers: food (A3) through estimatorBridge
 * Contract status: APPROVED
 */
import { getPhotoRootUri, resolvePhotoUri } from '@/shared/files/photoStorage';
import { fail, ok } from '@/shared/errors/result';
import { isAppError, toAppError } from '@/shared/errors/AppError';
import { getSettings } from '@/shared/settings/settingsRepository';
import { logger } from '@/shared/utils/logger';
import { getAnalysisAvailability, getApiKeyForProvider } from './availability';
import { postJson } from './httpClient';
import { prepareImageForAnalysis } from './imagePrep';
import { parseEstimateJson } from './parseEstimate';
import { buildSystemPrompt, buildUserText } from './prompt';
import { getProviderInfo } from './providers/catalog';
import { geminiAdapter } from './providers/geminiAdapter';
import { groqAdapter } from './providers/groqAdapter';
import type { VisionProvider } from './providers/types';
import type { NutritionEstimate, NutritionEstimateRequest } from '@/shared/types/nutritionAi';
import type { Result } from '@/shared/types/common';

const ADAPTERS: Record<string, VisionProvider> = {
  groq: groqAdapter,
  gemini: geminiAdapter,
};

/**
 * SEC-04: the URI must live inside the app-private photo root under `food/`. A progress photo, a
 * gallery URI, a remote URL or a content:// path is rejected before any request is built.
 */
export function assertPrivateFoodPhoto(imageUri: string): void {
  const root = getPhotoRootUri();
  if (typeof imageUri !== 'string' || !imageUri.startsWith(root)) {
    throw new Error('not-a-private-food-photo');
  }
  const withoutRoot = imageUri.slice(root.length);
  if (!withoutRoot.startsWith('food/') || withoutRoot.length <= 'food/'.length) {
    throw new Error('not-a-private-food-photo');
  }
  // Also verify the path is one this app could have produced, which blocks path traversal.
  resolvePhotoUri(withoutRoot);
}

/** API-AI-002 */
export async function estimateNutritionFromImage(
  request: NutritionEstimateRequest,
): Promise<Result<NutritionEstimate>> {
  // Step 1: availability. Consent is re-checked here as well as in the caller (SEC-03, two layers).
  const availability = await getAnalysisAvailability().catch(() => ({ state: 'disabled' }) as const);
  if (availability.state === 'disabled') {
    return fail('CONSENT_REQUIRED', 'Food photo analysis is turned off.');
  }
  if (availability.state !== 'ready') {
    return fail('NOT_CONFIGURED', 'Food photo analysis is not fully set up yet.');
  }

  // Step 2: the image must be a private food photo.
  try {
    assertPrivateFoodPhoto(request.imageUri);
  } catch {
    return fail('VALIDATION', 'Only your own meal photos can be analyzed.');
  }

  const providerId = availability.providerId;
  const adapter = ADAPTERS[providerId];
  if (!adapter) {
    return fail('NOT_CONFIGURED', 'That analysis provider is not available.');
  }

  let apiKey: string | null;
  try {
    apiKey = await getApiKeyForProvider(providerId);
  } catch (e) {
    return fail('STORAGE', toAppError(e).message);
  }
  if (apiKey === null || apiKey.length === 0) {
    return fail('NOT_CONFIGURED', 'Food photo analysis is not fully set up yet.');
  }

  const settings = await getSettings();
  const catalogEntry = getProviderInfo(providerId);
  const model = settings.ai.modelOverride ?? catalogEntry?.defaultModelId ?? '';
  if (model.length === 0) {
    return fail('NOT_CONFIGURED', 'No model is configured for the analysis service.');
  }

  // Step 3: downscale and encode in memory. Never written to disk, never logged.
  let imageBase64Jpeg: string;
  try {
    const prepared = await prepareImageForAnalysis(request.imageUri);
    imageBase64Jpeg = prepared.base64;
  } catch (e) {
    return fail('STORAGE', toAppError(e, 'STORAGE').message);
  }

  // Step 4: the single allowed HTTPS request.
  let responseText: string;
  try {
    const built = adapter.buildRequest({
      model,
      apiKey,
      systemPrompt: buildSystemPrompt(),
      userText: buildUserText({
        mealCategoryName: request.mealCategoryName,
        userNote: request.userNote,
        clarification: request.clarification,
      }),
      imageBase64Jpeg,
    });
    const response = await postJson({
      url: built.url,
      headers: built.headers,
      body: built.body,
      signal: request.signal,
    });
    responseText = adapter.extractText(response.json) ?? '';
  } catch (e) {
    if (isAppError(e)) {
      return fail(e.code, e.message);
    }
    logger.warn('The analysis request failed unexpectedly.', { name: e instanceof Error ? e.name : 'unknown' });
    return fail('NETWORK', 'The analysis service could not finish. Your photo is saved; try again.');
  }

  // Step 5: parse defensively; anything unusable becomes PARSE_ERROR.
  const parsed = parseEstimateJson(responseText);
  if (!parsed.ok) {
    return fail(parsed.error.code, parsed.error.message);
  }
  const estimate = parsed.value;

  return ok({
    description: estimate.description,
    items: estimate.items,
    portionText: estimate.portionText,
    nutrition: estimate.nutrition,
    confidence: estimate.confidence,
    clarification: estimate.clarification,
    providerId,
    modelId: model,
    notFood: estimate.notFood,
  });
}