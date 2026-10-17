/**
 * INTEGRATION CONTRACT: API-FOOD-015, API-FOOD-016
 * Purpose: orchestrates optional photo analysis. It reads `foodRows.ts` and `getDb` directly rather
 *          than importing `foodRepository.ts`, so there is no import cycle inside the food module.
 *
 *          Two privacy gates live here and both must pass before anything is sent:
 *            1. the entry must not be opted out (`analysisOptOut`), and
 *            2. the estimator itself re-checks consent, provider and key.
 *          A provider failure NEVER loses the photo or the row: it is recorded as the entry status.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (API-FOOD-015/016), ERROR_HANDLING_AND_SECURITY SEC-03/04
 * Consumers: food screens (A3), shell foreground hook (A7)
 * Contract status: APPROVED
 */
import { getDb } from '@/shared/db/database';
import { AppError, isAppError, toAppError } from '@/shared/errors/AppError';
// CONTRACT: API-FILE-002 (A1) — private photo URI resolution
import { resolvePhotoUri } from '@/shared/files/photoStorage';
import { logger } from '@/shared/utils/logger';
import { rowToFoodEntry, toFoodItemsJson } from '../data/foodRows';
import type { FoodEntryRow } from '../data/foodRows';
import {
  getFoodEntryRow,
  updateAnalysisColumns,
  setBackgroundAnalyzer,
} from '../data/foodRepository';
import {
  estimateNutritionFromImageSafe,
  getAnalysisAvailabilitySafe,
} from './estimatorBridge';
import type { Id } from '@/shared/types/common';
import type { FoodEntry } from '@/shared/types/food';

const RETRYABLE_CODES = ['OFFLINE', 'NETWORK', 'RATE_LIMITED'] as const;
const MAX_PER_RUN = 5;

/** Short, actionable, and never a raw provider body or stack trace (ERROR_HANDLING §3.8). */
function messageForCode(code: string): string {
  switch (code) {
    case 'OFFLINE':
      return "Couldn't reach the analysis service. Your photo is saved; try again later.";
    case 'NETWORK':
      return 'The analysis service could not be reached. Your photo is saved; try again later.';
    case 'RATE_LIMITED':
      return 'The analysis service is busy right now. Your photo is saved; try again later.';
    case 'NOT_CONFIGURED':
      return 'Photo analysis is not set up. Add values by hand instead.';
    case 'DISABLED':
    case 'NO_PROVIDER':
    case 'NO_CONSENT':
    case 'NO_API_KEY':
      return 'Photo analysis is off for now. Add values by hand instead.';
    case 'CONSENT_REQUIRED':
      return 'Photo analysis needs your consent in Settings before it can run.';
    case 'PARSE_ERROR':
      return "The analysis service sent something unexpected. Your photo is saved; try again.";
    case 'CANCELLED':
      return 'Analysis was cancelled. Your photo is saved.';
    case 'VALIDATION':
      return 'This photo cannot be sent for analysis. Your photo is saved.';
    default:
      return 'The analysis service could not finish. Your photo is saved; try again.';
  }
}

/** LOCAL-WORKAROUND (internal): the raw failure code, so the batch loop can stop on rate limits. */
interface AnalyzeOutcome {
  entry: FoodEntry;
  failureCode: string | null;
}

/** API-FOOD-015 */
export async function analyzeFoodEntry(
  id: Id,
  options?: { clarification?: { question: string; answer: string }; overwrite?: boolean },
): Promise<FoodEntry> {
  return (await analyze(id, options)).entry;
}

async function analyze(
  id: Id,
  options?: { clarification?: { question: string; answer: string }; overwrite?: boolean },
): Promise<AnalyzeOutcome> {
  const row = await getFoodEntryRow(id);
  const entry = rowToFoodEntry(row);

  if (entry.analysisOptOut) {
    throw new AppError(
      'CONSENT_REQUIRED',
      'You chose not to send this photo for analysis.',
    );
  }
  if (
    (entry.nutritionSource === 'manual' || entry.nutritionSource === 'confirmed') &&
    options?.overwrite !== true
  ) {
    throw new AppError(
      'CONFLICT',
      'You already entered values for this meal. Choose to replace them if you want a new estimate.',
    );
  }

  await updateAnalysisColumns(id, {
    analysisStatus: 'in_progress',
    analysisError: null,
  });

  const availability = await getAnalysisAvailabilitySafe();
  if (availability.state !== 'ready') {
    return {
      entry: await updateAnalysisColumns(id, {
        analysisStatus: 'pending',
        analysisError: messageForCode(availability.state.toUpperCase()),
      }),
      failureCode: null,
    };
  }

  const categoryName = await lookupCategoryName(row.meal_category_id);
  const result = await estimateNutritionFromImageSafe({
    imageUri: resolvePhotoUri(entry.imagePath),
    mealCategoryName: categoryName,
    userNote: entry.note ?? undefined,
    clarification: options?.clarification,
  });

  if (!result.ok) {
    const code = result.error.code;
    const status = (RETRYABLE_CODES as readonly string[]).includes(code) ? 'pending' : 'failed';
    logger.warn('Meal analysis did not finish.', { code });
    return {
      entry: await updateAnalysisColumns(id, {
        analysisStatus: status,
        analysisError: messageForCode(code),
      }),
      failureCode: code,
    };
  }

  const estimate = result.value;
  if (estimate.notFood) {
    return {
      entry: await updateAnalysisColumns(id, {
        analysisStatus: 'failed',
        analysisError: "This doesn't look like food, so nothing was estimated.",
        analyzedAt: new Date().toISOString(),
        analysisProvider: estimate.providerId,
        pendingClarification: null,
      }),
      failureCode: 'NOT_FOOD',
    };
  }

  const db = await getDb();
  await db.execute('UPDATE food_entries SET foods_json = ? WHERE id = ?', [
    toFoodItemsJson(
      estimate.items.map((item) => ({
        name: item.name,
        portionText: item.portionText,
        caloriesKcal: item.caloriesKcal,
        proteinGrams: item.proteinGrams,
      })),
    ),
    id,
  ]);

  return {
    entry: await updateAnalysisColumns(id, {
      analysisStatus: 'succeeded',
      analysisProvider: estimate.providerId,
      analysisError: null,
      analyzedAt: new Date().toISOString(),
      pendingClarification: estimate.clarification,
      nutrition: estimate.nutrition,
      nutritionSource: 'ai_estimate',
      confidence: estimate.confidence,
      description: estimate.description,
    }),
    failureCode: null,
  };
}

/** API-FOOD-016 — sequential, at most five per call, stops at the first rate limit. */
export async function processPendingAnalyses(): Promise<{ processed: number; failed: number }> {
  const availability = await getAnalysisAvailabilitySafe();
  if (availability.state !== 'ready') {
    return { processed: 0, failed: 0 };
  }

  const db = await getDb();
  const rows = await db.query<FoodEntryRow>(
    `SELECT * FROM food_entries
      WHERE analysis_status = 'pending' AND analysis_opt_out = 0
      ORDER BY created_at ASC
      LIMIT ${MAX_PER_RUN}`,
  );

  let processed = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const outcome = await analyze(row.id);
      if (outcome.failureCode === 'RATE_LIMITED') {
        // Stop the batch: the provider is throttling us and more calls would only make it worse.
        break;
      }
      if (outcome.entry.analysisStatus === 'failed') {
        failed += 1;
      } else {
        processed += 1;
      }
    } catch (e) {
      const error = toAppError(e);
      if (error.code === 'RATE_LIMITED') {
        break;
      }
      failed += 1;
      if (!isAppError(e)) {
        logger.warn('A pending analysis threw.', { error: String(e) });
      }
    }
  }
  return { processed, failed };
}

// Lets `createFoodEntryFromPhoto` start a background estimate without an import cycle.
setBackgroundAnalyzer((entryId) => analyzeFoodEntry(entryId));

/** LOCAL-WORKAROUND (internal): the category label is only prompt context for the estimator. */
async function lookupCategoryName(mealCategoryId: string): Promise<string | undefined> {
  const row = await getDb().then((db) =>
    db.queryOne<{ name: string }>('SELECT name FROM meal_categories WHERE id = ?', [mealCategoryId]),
  );
  return row?.name;
}