/**
 * INTEGRATION CONTRACT: API-FOOD-006 .. API-FOOD-014
 * Purpose: food entries. Logging NEVER fails because analysis is off, offline or broken: the photo
 *          and the row are saved locally first, and every nutrition transition is an explicit user
 *          action. Nothing is ever learned silently from past corrections.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (API-FOOD-006..014), ERROR_HANDLING_AND_SECURITY §3.1
 * Consumers: food screens (A3), reminders (A2), progress (A6)
 * Contract status: APPROVED
 */
import { getDb } from '@/shared/db/database';
import { AppError, toAppError } from '@/shared/errors/AppError';
import { appEvents } from '@/shared/events/appEvents';
// CONTRACT: API-FILE-001..004 (A1) — private photo storage
import { deletePhoto, savePhotoFromUri } from '@/shared/files/photoStorage';
import { localDateFromInstant, nowIso } from '@/shared/utils/dates';
import { newId } from '@/shared/utils/ids';
import { logger } from '@/shared/utils/logger';
import { listMealCategories } from './mealCategoryRepository';
import { getAnalysisAvailabilitySafe } from '../services/estimatorBridge';
import { scaleNutrition } from '../domain/nutritionMath';
import {
  EMPTY_NUTRITION,
  FOOD_ENTRY_COLUMNS,
  nutritionParams,
  rowToFoodEntry,
  toFoodItemsJson,
  validateNutritionValues,
} from './foodRows';
import type { FoodEntryRow } from './foodRows';
import type { Id, LocalDate } from '@/shared/types/common';
import type {
  CreateFoodEntryInput,
  FoodEntry,
  FoodEntryDetailsPatch,
  NutritionValues,
} from '@/shared/types/food';

const COUNTED_SOURCES = ['ai_estimate', 'confirmed', 'manual'] as const;

async function loadRow(id: Id): Promise<FoodEntryRow> {
  const db = await getDb();
  const row = await db.queryOne<FoodEntryRow>(
    `SELECT ${FOOD_ENTRY_COLUMNS} FROM food_entries WHERE id = ?`,
    [id],
  );
  if (!row) {
    throw new AppError('NOT_FOUND', 'That meal is no longer in your log.');
  }
  return row;
}

/** LOCAL-WORKAROUND (internal): background analysis hook, filled in by analysisService in Stage 4. */
export type BackgroundAnalyzer = (entryId: Id) => Promise<unknown>;

let backgroundAnalyzer: BackgroundAnalyzer | null = null;

export function setBackgroundAnalyzer(analyzer: BackgroundAnalyzer | null): void {
  backgroundAnalyzer = analyzer;
}

/** LOCAL-WORKAROUND (internal): true once the analysis service is wired in. */
export function isAnalysisWired(): boolean {
  return backgroundAnalyzer !== null;
}

function emitSaved(entry: FoodEntry): void {
  appEvents.emit('food.entry.saved', {
    entryId: entry.id,
    mealCategoryId: entry.mealCategoryId,
    localDate: entry.localDate,
  });
}

/** API-FOOD-006 */
export async function createFoodEntryFromPhoto(
  input: CreateFoodEntryInput,
): Promise<FoodEntry> {
  const categories = await listMealCategories();
  const category = categories.find((c) => c.id === input.mealCategoryId);
  if (!category) {
    throw new AppError('NOT_FOUND', 'Choose a meal from your list.');
  }

  const capturedAt = input.capturedAt ?? nowIso();
  const capturedMs = Date.parse(capturedAt);
  if (Number.isNaN(capturedMs)) {
    throw new AppError('VALIDATION', 'That time is not valid.');
  }
  if (capturedMs > Date.now() + 60_000) {
    throw new AppError('VALIDATION', 'A meal cannot be logged in the future.');
  }

  const id = newId();
  const stored = await savePhotoFromUri({ kind: 'food', id, sourceUri: input.tempImageUri });
  const localDate = localDateFromInstant(capturedAt);
  const analysisOptOut = input.analysisOptOut === true;
  const availability = await getAnalysisAvailabilitySafe();
  const isReady = availability.state === 'ready';
  const status =
    analysisOptOut && isReady
      ? 'skipped_by_user'
      : isReady
        ? 'pending'
        : 'not_requested';
  const ts = nowIso();

  try {
    await (await getDb()).execute(
      `INSERT INTO food_entries (id, meal_category_id, image_path, captured_at, local_date, note,
          description, foods_json, portion_text, calories_kcal, protein_g, carbs_g, fat_g,
          nutrition_source, confidence, analysis_status, analysis_opt_out, analysis_provider,
          analysis_error, analyzed_at, clarification_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, '[]', NULL, NULL, NULL, NULL, NULL, 'none', 'unknown', ?, ?, NULL, NULL, NULL, NULL, ?, ?)`,
      [
        id,
        input.mealCategoryId,
        stored.relativePath,
        capturedAt,
        localDate,
        input.note ?? null,
        status,
        analysisOptOut ? 1 : 0,
        ts,
        ts,
      ],
    );
  } catch (e) {
    // A failed insert must not leave an orphaned photo behind (ERROR_HANDLING §3.3).
    try {
      await deletePhoto(stored.relativePath);
    } catch {
      // Best effort: the entry never existed, so nothing is left inconsistent in the database.
    }
    throw toAppError(e, 'STORAGE');
  }

  const entry = rowToFoodEntry(await loadRow(id));
  emitSaved(entry);

  if (status === 'pending' && backgroundAnalyzer) {
    const analyzer = backgroundAnalyzer;
    void analyzer(id).catch((e) => {
      logger.warn('Background analysis could not be started.', { error: String(toAppError(e)) });
    });
  }

  return entry;
}

/** API-FOOD-007 */
export async function getFoodEntry(id: Id): Promise<FoodEntry> {
  return rowToFoodEntry(await loadRow(id));
}

/** API-FOOD-008 */
export async function listFoodEntriesForDate(date: LocalDate): Promise<FoodEntry[]> {
  const db = await getDb();
  const rows = await db.query<FoodEntryRow>(
    `SELECT ${FOOD_ENTRY_COLUMNS} FROM food_entries WHERE local_date = ? ORDER BY captured_at ASC`,
    [date],
  );
  return rows.map(rowToFoodEntry);
}

/** API-FOOD-009 — changing `capturedAt` recomputes `localDate` so totals stay correct. */
export async function updateFoodEntryDetails(
  id: Id,
  patch: FoodEntryDetailsPatch,
): Promise<FoodEntry> {
  const current = rowToFoodEntry(await loadRow(id));
  const next: FoodEntry = {
    ...current,
    mealCategoryId: patch.mealCategoryId ?? current.mealCategoryId,
    note: patch.note === undefined ? current.note : patch.note,
    description: patch.description === undefined ? current.description : patch.description,
    portionText: patch.portionText === undefined ? current.portionText : patch.portionText,
    foods: patch.foods ?? current.foods,
    capturedAt: patch.capturedAt ?? current.capturedAt,
    localDate: patch.capturedAt ? localDateFromInstant(patch.capturedAt) : current.localDate,
    updatedAt: nowIso(),
  };

  if (patch.mealCategoryId !== undefined) {
    const categories = await listMealCategories();
    if (!categories.some((c) => c.id === patch.mealCategoryId)) {
      throw new AppError('NOT_FOUND', 'Choose a meal from your list.');
    }
  }
  if (next.note !== null && next.note.length > 2000) {
    throw new AppError('VALIDATION', 'Notes must be 2000 characters or fewer.');
  }
  if (next.foods.length > 100) {
    throw new AppError('VALIDATION', 'That is too many food items for one meal.');
  }

  await (await getDb()).execute(
    `UPDATE food_entries
        SET meal_category_id = ?, captured_at = ?, local_date = ?, note = ?, description = ?,
            portion_text = ?, foods_json = ?, updated_at = ?
      WHERE id = ?`,
    [
      next.mealCategoryId,
      next.capturedAt,
      next.localDate,
      next.note,
      next.description,
      next.portionText,
      toFoodItemsJson(next.foods),
      next.updatedAt,
      id,
    ],
  );

  const updated = rowToFoodEntry(await loadRow(id));
  emitSaved(updated);
  return updated;
}

async function writeNutrition(
  id: Id,
  values: NutritionValues,
  source: FoodEntry['nutritionSource'],
  confidence: FoodEntry['confidence'],
): Promise<FoodEntry> {
  const validated = validateNutritionValues(values);
  await (await getDb()).execute(
    `UPDATE food_entries
        SET calories_kcal = ?, protein_g = ?, carbs_g = ?, fat_g = ?, nutrition_source = ?,
            confidence = ?, updated_at = ?
      WHERE id = ?`,
    [...nutritionParams(validated), source, confidence, nowIso(), id],
  );
  const entry = rowToFoodEntry(await loadRow(id));
  emitSaved(entry);
  return entry;
}

/** API-FOOD-010 — a manual entry always wins over any estimate, and is labelled `Manual`. */
export async function saveManualNutrition(id: Id, values: NutritionValues): Promise<FoodEntry> {
  await loadRow(id);
  return writeNutrition(id, values, 'manual', 'unknown');
}

/** API-FOOD-011 */
export async function confirmAiEstimate(
  id: Id,
  edited?: Partial<NutritionValues>,
): Promise<FoodEntry> {
  const current = rowToFoodEntry(await loadRow(id));
  if (current.nutritionSource !== 'ai_estimate' && current.nutritionSource !== 'confirmed') {
    throw new AppError(
      'CONFLICT',
      'This meal already has values you entered. Edit them instead.',
    );
  }
  const merged: NutritionValues = {
    caloriesKcal: edited?.caloriesKcal ?? current.nutrition.caloriesKcal,
    proteinGrams: edited?.proteinGrams ?? current.nutrition.proteinGrams,
    carbsGrams: edited?.carbsGrams ?? current.nutrition.carbsGrams,
    fatGrams: edited?.fatGrams ?? current.nutrition.fatGrams,
  };
  return writeNutrition(id, merged, 'confirmed', current.confidence);
}

/** API-FOOD-012 */
export async function markNutritionUnknown(id: Id): Promise<FoodEntry> {
  await loadRow(id);
  return writeNutrition(id, { ...EMPTY_NUTRITION }, 'unknown', 'unknown');
}

/** API-FOOD-013 — scaling an unconfirmed estimate means the user corrected it, so it becomes confirmed. */
export async function scaleEntryPortion(id: Id, factor: number): Promise<FoodEntry> {
  if (!Number.isFinite(factor) || factor < 0.25 || factor > 4) {
    throw new AppError('VALIDATION', 'Portion size can be adjusted between a quarter and four times.');
  }
  const current = rowToFoodEntry(await loadRow(id));
  if (current.nutrition.caloriesKcal === null && current.nutrition.proteinGrams === null) {
    throw new AppError('CONFLICT', 'There are no values to scale yet.');
  }
  const scaled = scaleNutrition(current.nutrition, factor);
  const source: FoodEntry['nutritionSource'] =
    current.nutritionSource === 'ai_estimate' ? 'confirmed' : current.nutritionSource;
  return writeNutrition(id, scaled, source, current.confidence);
}

/** API-FOOD-014 */
export async function deleteFoodEntry(id: Id): Promise<void> {
  const row = await loadRow(id);
  const entry = rowToFoodEntry(row);
  const db = await getDb();
  await db.execute('DELETE FROM food_entries WHERE id = ?', [id]);
  try {
    await deletePhoto(entry.imagePath);
  } catch (e) {
    // The row is already gone; a leftover file must not make the delete look like a failure.
    logger.warn('A deleted meal photo could not be removed from storage.', {
      error: String(toAppError(e)),
    });
  }
  appEvents.emit('food.entry.deleted', { entryId: id, localDate: entry.localDate });
}

/** LOCAL-WORKAROUND (internal): shared with totals.ts so both apply the same counting rule. */
export function isCountedSource(source: FoodEntry['nutritionSource']): boolean {
  return (COUNTED_SOURCES as readonly string[]).includes(source);
}

/** LOCAL-WORKAROUND (internal): used by totals.ts, which needs raw rows, not mapped entries. */
export async function listFoodRowsForDate(date: LocalDate): Promise<FoodEntryRow[]> {
  return (await getDb()).query<FoodEntryRow>(
    `SELECT ${FOOD_ENTRY_COLUMNS} FROM food_entries WHERE local_date = ? ORDER BY captured_at ASC`,
    [date],
  );
}

/** LOCAL-WORKAROUND (internal): used by analysisService to read and write one row without a cycle. */
export async function getFoodEntryRow(id: Id): Promise<FoodEntryRow> {
  return loadRow(id);
}

/** LOCAL-WORKAROUND (internal): used by analysisService to write analysis results without a cycle. */
export async function updateAnalysisColumns(
  id: Id,
  patch: {
    analysisStatus: FoodEntry['analysisStatus'];
    analysisProvider?: FoodEntry['analysisProvider'];
    analysisError?: string | null;
    analyzedAt?: string | null;
    pendingClarification?: FoodEntry['pendingClarification'];
    nutrition?: NutritionValues;
    nutritionSource?: FoodEntry['nutritionSource'];
    confidence?: FoodEntry['confidence'];
    description?: string | null;
  },
): Promise<FoodEntry> {
  const current = rowToFoodEntry(await loadRow(id));
  const nutrition = patch.nutrition
    ? validateNutritionValues(patch.nutrition)
    : current.nutrition;
  await (await getDb()).execute(
    `UPDATE food_entries
        SET analysis_status = ?, analysis_provider = ?, analysis_error = ?, analyzed_at = ?,
            clarification_json = ?, calories_kcal = ?, protein_g = ?, carbs_g = ?, fat_g = ?,
            nutrition_source = ?, confidence = ?, description = ?, updated_at = ?
      WHERE id = ?`,
    [
      patch.analysisStatus,
      patch.analysisProvider ?? current.analysisProvider,
      patch.analysisError === undefined ? current.analysisError : patch.analysisError,
      patch.analyzedAt === undefined ? current.analyzedAt : patch.analyzedAt,
      patch.pendingClarification === undefined
        ? current.pendingClarification
          ? JSON.stringify({
              question: current.pendingClarification.question,
              options: current.pendingClarification.options,
              affects: current.pendingClarification.affects,
            })
          : null
        : patch.pendingClarification
          ? JSON.stringify({
              question: patch.pendingClarification.question,
              options: patch.pendingClarification.options,
              affects: patch.pendingClarification.affects,
            })
          : null,
      ...nutritionParams(nutrition),
      patch.nutritionSource ?? current.nutritionSource,
      patch.confidence ?? current.confidence,
      patch.description === undefined ? current.description : patch.description,
      nowIso(),
      id,
    ],
  );
  const entry = rowToFoodEntry(await loadRow(id));
  emitSaved(entry);
  return entry;
}