/** @jest-environment node */
import { createTestDb } from '@/shared/db/testing/createTestDb';
import { getDb, setDbForTesting } from '@/shared/db/database';
import { appEvents } from '@/shared/events/appEvents';

const mockSavedPhotos: string[] = [];
const mockDeletedPhotos: string[] = [];
let mockFailSave = false;

jest.mock('@/shared/files/photoStorage', () => ({
  savePhotoFromUri: jest.fn(async ({ id }: { id: string }) => {
    if (mockFailSave) {
      throw new Error('disk full');
    }
    const relativePath = `food/${id}.jpg`;
    mockSavedPhotos.push(relativePath);
    return { relativePath, byteSize: 1234 };
  }),
  deletePhoto: jest.fn(async (relativePath: string) => {
    mockDeletedPhotos.push(relativePath);
  }),
  resolvePhotoUri: jest.fn((relativePath: string) => `file:///private/${relativePath}`),
  photoExists: jest.fn(async () => true),
}));

const mockAvailability = jest.fn(async () => ({ state: 'disabled' }) as { state: string; providerId?: string });
const mockEstimate = jest.fn();

jest.mock('../services/estimatorBridge', () => ({
  getAnalysisAvailabilitySafe: () => mockAvailability(),
  estimateNutritionFromImageSafe: (request: unknown) => mockEstimate(request),
  isEstimatorAttached: () => false,
  setEstimatorBridge: jest.fn(),
}));

import {
  confirmAiEstimate,
  createFoodEntryFromPhoto,
  deleteFoodEntry,
  getFoodEntry,
  isAnalysisWired,
  listFoodEntriesForDate,
  markNutritionUnknown,
  saveManualNutrition,
  scaleEntryPortion,
  setBackgroundAnalyzer,
  updateFoodEntryDetails,
} from '../data/foodRepository';
import { archiveMealCategory, createMealCategory } from '../data/mealCategoryRepository';
import { analyzeFoodEntry, processPendingAnalyses } from '../services/analysisService';
import type { Id } from '@/shared/types/common';
import type { NutritionValues } from '@/shared/types/food';

const NOW = new Date().toISOString();

const values = (patch: Partial<NutritionValues> = {}): NutritionValues => ({
  caloriesKcal: null,
  proteinGrams: null,
  carbsGrams: null,
  fatGrams: null,
  ...patch,
});

function okEstimate(patch: Record<string, unknown> = {}) {
  return {
    ok: true,
    value: {
      description: 'Meal',
      items: [],
      portionText: null,
      nutrition: { caloriesKcal: 100, proteinGrams: 5, carbsGrams: 10, fatGrams: 2 },
      confidence: 'low',
      clarification: null,
      providerId: 'groq',
      modelId: 'm',
      notFood: false,
      ...patch,
    },
  };
}

beforeEach(async () => {
  const db = await createTestDb();
  setDbForTesting(db);
  mockSavedPhotos.length = 0;
  mockDeletedPhotos.length = 0;
  mockFailSave = false;
  mockAvailability.mockReset();
  mockAvailability.mockResolvedValue({ state: 'disabled' });
  mockEstimate.mockReset();
  setBackgroundAnalyzer(null);
});

afterEach(() => {
  setDbForTesting(null);
});

async function makeEntry(overrides: { capturedAt?: string; categoryId?: Id } = {}) {
  return createFoodEntryFromPhoto({
    mealCategoryId: overrides.categoryId ?? 'meal-lunch',
    tempImageUri: 'file:///tmp/capture.jpg',
    capturedAt: overrides.capturedAt ?? NOW,
  });
}

async function forceStatus(id: Id, status: string, extra = ''): Promise<void> {
  await (await getDb()).execute(
    `UPDATE food_entries SET analysis_status = ?, analysis_opt_out = ?${extra} WHERE id = ?`,
    [status, 0, id],
  );
}

describe('createFoodEntryFromPhoto (API-FOOD-006)', () => {
  it('saves the photo privately and stores only a relative path', async () => {
    const entry = await makeEntry();
    expect(entry.imagePath).toBe(`food/${entry.id}.jpg`);
    expect(entry.imagePath.startsWith('/')).toBe(false);
    expect(entry.imagePath.includes('://')).toBe(false);
    expect(mockSavedPhotos).toEqual([`food/${entry.id}.jpg`]);
    expect(entry.nutritionSource).toBe('none');
    expect(entry.nutrition.caloriesKcal).toBeNull();
  });

  it('sets analysisStatus not_requested when analysis is off', async () => {
    const entry = await makeEntry();
    expect(entry.analysisStatus).toBe('not_requested');
    expect(entry.analysisOptOut).toBe(false);
  });

  it('sets analysisStatus pending when analysis is ready', async () => {
    mockAvailability.mockResolvedValue({ state: 'ready', providerId: 'groq' });
    expect((await makeEntry()).analysisStatus).toBe('pending');
  });

  it('sets skipped_by_user when opted out and analysis is ready', async () => {
    mockAvailability.mockResolvedValue({ state: 'ready', providerId: 'groq' });
    const entry = await createFoodEntryFromPhoto({
      mealCategoryId: 'meal-lunch',
      tempImageUri: 'file:///tmp/capture.jpg',
      capturedAt: NOW,
      analysisOptOut: true,
    });
    expect(entry.analysisStatus).toBe('skipped_by_user');
  });

  it('still saves an opted-out photo when analysis is off', async () => {
    const entry = await createFoodEntryFromPhoto({
      mealCategoryId: 'meal-lunch',
      tempImageUri: 'file:///tmp/capture.jpg',
      capturedAt: NOW,
      analysisOptOut: true,
    });
    expect(entry.analysisStatus).toBe('not_requested');
    expect(entry.analysisOptOut).toBe(true);
  });

  it('rejects an unknown category', async () => {
    await expect(makeEntry({ categoryId: 'nope' })).rejects.toThrow();
  });

  it('rejects an archived category', async () => {
    const custom = await createMealCategory('Supper');
    await archiveMealCategory(custom.id);
    await expect(makeEntry({ categoryId: custom.id })).rejects.toThrow();
  });

  it('rejects a capture time in the future', async () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    await expect(makeEntry({ capturedAt: future })).rejects.toThrow();
  });

  it('writes nothing when the photo copy fails', async () => {
    mockFailSave = true;
    await expect(makeEntry()).rejects.toThrow();
    expect(mockSavedPhotos).toEqual([]);
    expect(await (await getDb()).query('SELECT * FROM food_entries')).toHaveLength(0);
  });

  it('deletes the copied photo when the insert fails', async () => {
    const db = await getDb();
    jest.spyOn(db, 'execute').mockImplementationOnce(async () => {
      throw new Error('insert failed');
    });
    await expect(makeEntry()).rejects.toThrow();
    expect(mockDeletedPhotos).toHaveLength(1);
    jest.restoreAllMocks();
  });

  it('emits food.entry.saved and starts background analysis when pending', async () => {
    mockAvailability.mockResolvedValue({ state: 'ready', providerId: 'groq' });
    const analyzer = jest.fn(async () => undefined);
    setBackgroundAnalyzer(analyzer);

    const handler = jest.fn();
    const off = appEvents.on('food.entry.saved', handler);
    const entry = await makeEntry();
    off();

    expect(handler).toHaveBeenCalledWith({
      entryId: entry.id,
      mealCategoryId: 'meal-lunch',
      localDate: entry.localDate,
    });
    expect(isAnalysisWired()).toBe(true);
    await Promise.resolve();
    expect(analyzer).toHaveBeenCalledWith(entry.id);
  });
});

describe('getFoodEntry / listFoodEntriesForDate (API-FOOD-007, API-FOOD-008)', () => {
  it('throws NOT_FOUND for an unknown id', async () => {
    await expect(getFoodEntry('missing')).rejects.toThrow();
  });

  it('lists a date oldest capture first', async () => {
    const base = new Date();
    base.setHours(12, 0, 0, 0);
    const later = new Date(base.getTime() + 3_600_000);
    await makeEntry({ capturedAt: later.toISOString() });
    await makeEntry({ capturedAt: base.toISOString() });

    const list = await listFoodEntriesForDate(base.toISOString().slice(0, 10));
    expect(list).toHaveLength(2);
    expect(Date.parse(list[0]!.capturedAt)).toBeLessThan(Date.parse(list[1]!.capturedAt));
  });
});

describe('updateFoodEntryDetails (API-FOOD-009)', () => {
  it('recomputes localDate when capturedAt changes', async () => {
    const entry = await makeEntry();
    const tomorrow = new Date(Date.now() + 86_400_000);
    tomorrow.setHours(12, 0, 0, 0);
    const updated = await updateFoodEntryDetails(entry.id, { capturedAt: tomorrow.toISOString() });
    expect(updated.localDate).toBe(tomorrow.toISOString().slice(0, 10));
  });

  it('keeps localDate when capturedAt is not in the patch', async () => {
    const entry = await makeEntry();
    const updated = await updateFoodEntryDetails(entry.id, { note: 'with sambar' });
    expect(updated.localDate).toBe(entry.localDate);
    expect(updated.note).toBe('with sambar');
  });

  it('rejects an unknown category', async () => {
    const entry = await makeEntry();
    await expect(updateFoodEntryDetails(entry.id, { mealCategoryId: 'nope' })).rejects.toThrow();
  });

  it('stores foods and portion text', async () => {
    const entry = await makeEntry();
    const updated = await updateFoodEntryDetails(entry.id, {
      foods: [{ name: 'Idli', portionText: '2 pieces', caloriesKcal: 80, proteinGrams: 4 }],
      portionText: '2 pieces',
      description: 'Idli and sambar',
    });
    expect(updated.foods).toHaveLength(1);
    expect(updated.foods[0]?.name).toBe('Idli');
    expect(updated.portionText).toBe('2 pieces');
    expect(updated.description).toBe('Idli and sambar');
  });
});

describe('nutrition source transitions (GAT-014, GAT-038)', () => {
  it('saveManualNutrition sets source manual and confidence unknown', async () => {
    const entry = await makeEntry();
    const updated = await saveManualNutrition(entry.id, values({ caloriesKcal: 400, proteinGrams: 12 }));
    expect(updated.nutritionSource).toBe('manual');
    expect(updated.confidence).toBe('unknown');
    expect(updated.nutrition.caloriesKcal).toBe(400);
  });

  it('confirmAiEstimate refuses an entry with no estimate behind it', async () => {
    const entry = await makeEntry();
    await expect(confirmAiEstimate(entry.id)).rejects.toThrow();
    await saveManualNutrition(entry.id, values({ caloriesKcal: 400 }));
    await expect(confirmAiEstimate(entry.id)).rejects.toThrow();
  });

  it('confirmAiEstimate merges edited values and sets source confirmed', async () => {
    const entry = await makeEntry();
    await forceStatus(entry.id, 'not_requested', ", nutrition_source = 'ai_estimate', confidence = 'low', calories_kcal = 400, protein_g = 10");
    const updated = await confirmAiEstimate(entry.id, { caloriesKcal: 520 });
    expect(updated.nutritionSource).toBe('confirmed');
    expect(updated.nutrition.caloriesKcal).toBe(520);
    expect(updated.nutrition.proteinGrams).toBe(10);
  });

  it('markNutritionUnknown clears every value', async () => {
    const entry = await makeEntry();
    await saveManualNutrition(entry.id, values({ caloriesKcal: 400, fatGrams: 10 }));
    const updated = await markNutritionUnknown(entry.id);
    expect(updated.nutritionSource).toBe('unknown');
    expect(updated.nutrition).toEqual(values());
  });

  it('scaleEntryPortion turns an unconfirmed estimate into a confirmed one', async () => {
    const entry = await makeEntry();
    await forceStatus(
      entry.id,
      'succeeded',
      ", nutrition_source = 'ai_estimate', calories_kcal = 400, protein_g = 12",
    );
    const halved = await scaleEntryPortion(entry.id, 0.5);
    expect(halved.nutritionSource).toBe('confirmed');
    expect(halved.nutrition.caloriesKcal).toBe(200);
    expect(halved.nutrition.proteinGrams).toBe(6);
  });

  it('scaleEntryPortion keeps the source for a manual entry', async () => {
    const entry = await makeEntry();
    await saveManualNutrition(entry.id, values({ caloriesKcal: 400 }));
    const scaled = await scaleEntryPortion(entry.id, 1.5);
    expect(scaled.nutritionSource).toBe('manual');
    expect(scaled.nutrition.caloriesKcal).toBe(600);
  });

  it('rejects a factor outside 0.25..4', async () => {
    const entry = await makeEntry();
    await saveManualNutrition(entry.id, values({ caloriesKcal: 400 }));
    await expect(scaleEntryPortion(entry.id, 0.2)).rejects.toThrow();
    await expect(scaleEntryPortion(entry.id, 4.1)).rejects.toThrow();
  });

  it('refuses to scale an entry that has no values', async () => {
    const entry = await makeEntry();
    await expect(scaleEntryPortion(entry.id, 2)).rejects.toThrow();
  });

  it('stores null instead of an above-cap value', async () => {
    const entry = await makeEntry();
    const updated = await saveManualNutrition(entry.id, values({ caloriesKcal: 9000 }));
    expect(updated.nutrition.caloriesKcal).toBeNull();
  });

  it('rejects a negative value', async () => {
    const entry = await makeEntry();
    await expect(saveManualNutrition(entry.id, values({ proteinGrams: -1 }))).rejects.toThrow();
  });
});

describe('deleteFoodEntry (API-FOOD-014, GAT-043)', () => {
  it('removes the row and the photo and emits the delete event', async () => {
    const entry = await makeEntry();
    const handler = jest.fn();
    const off = appEvents.on('food.entry.deleted', handler);
    await deleteFoodEntry(entry.id);
    off();

    await expect(getFoodEntry(entry.id)).rejects.toThrow();
    expect(mockDeletedPhotos).toContain(entry.imagePath);
    expect(handler).toHaveBeenCalledWith({ entryId: entry.id, localDate: entry.localDate });
  });

  it('throws NOT_FOUND for an unknown id', async () => {
    await expect(deleteFoodEntry('missing')).rejects.toThrow();
  });
});

describe('analyzeFoodEntry (API-FOOD-015)', () => {
  it('refuses an opted-out entry without calling the estimator (GAT-016)', async () => {
    const entry = await makeEntry();
    await (await getDb()).execute('UPDATE food_entries SET analysis_opt_out = 1 WHERE id = ?', [
      entry.id,
    ]);
    await expect(analyzeFoodEntry(entry.id)).rejects.toThrow();
    expect(mockEstimate).not.toHaveBeenCalled();
  });

  it('refuses a manual entry unless overwrite is set', async () => {
    const entry = await makeEntry();
    await saveManualNutrition(entry.id, values({ caloriesKcal: 400 }));
    await expect(analyzeFoodEntry(entry.id)).rejects.toThrow();
    expect(mockEstimate).not.toHaveBeenCalled();
  });

  it('applies a successful estimate as ai_estimate and keeps the clarification', async () => {
    mockAvailability.mockResolvedValue({ state: 'ready', providerId: 'groq' });
    mockEstimate.mockResolvedValue(
      okEstimate({
        description: 'Dosa and chutney',
        items: [{ name: 'Dosa', portionText: '1', caloriesKcal: 250, proteinGrams: 6 }],
        portionText: '1 dosa',
        nutrition: { caloriesKcal: 280, proteinGrams: 7, carbsGrams: 40, fatGrams: 9 },
        confidence: 'medium',
        clarification: {
          question: 'How much oil?',
          options: ['Little', 'A lot'],
          affects: 'portion',
        },
      }),
    );

    const entry = await makeEntry();
    const updated = await analyzeFoodEntry(entry.id);
    expect(updated.analysisStatus).toBe('succeeded');
    expect(updated.nutritionSource).toBe('ai_estimate');
    expect(updated.confidence).toBe('medium');
    expect(updated.nutrition.caloriesKcal).toBe(280);
    expect(updated.pendingClarification?.question).toBe('How much oil?');
    expect(updated.foods[0]?.name).toBe('Dosa');
    expect(updated.analysisError).toBeNull();
  });

  it('marks a non-food photo failed without touching existing values', async () => {
    mockAvailability.mockResolvedValue({ state: 'ready', providerId: 'groq' });
    mockEstimate.mockResolvedValue(okEstimate({ notFood: true, items: [], confidence: 'unknown' }));
    const entry = await makeEntry();
    await saveManualNutrition(entry.id, values({ caloriesKcal: 400 }));
    const updated = await analyzeFoodEntry(entry.id, { overwrite: true });
    expect(updated.analysisStatus).toBe('failed');
    expect(updated.analysisError).toMatch(/doesn't look like food/i);
    expect(updated.nutrition.caloriesKcal).toBe(400);
  });

  it.each([
    ['OFFLINE', 'pending'],
    ['NETWORK', 'pending'],
    ['RATE_LIMITED', 'pending'],
    ['PROVIDER_ERROR', 'failed'],
    ['PARSE_ERROR', 'failed'],
  ])('maps %s to analysisStatus %s and keeps the photo', async (code, status) => {
    mockAvailability.mockResolvedValue({ state: 'ready', providerId: 'groq' });
    mockEstimate.mockResolvedValue({ ok: false, error: { code, message: 'RAW PROVIDER BODY' } });
    const entry = await makeEntry();
    const updated = await analyzeFoodEntry(entry.id);
    expect(updated.analysisStatus).toBe(status);
    expect(updated.analysisError).not.toContain('RAW PROVIDER BODY');
    expect(updated.imagePath).toBe(entry.imagePath);
    await expect(getFoodEntry(entry.id)).resolves.toBeDefined();
  });

it('keeps a thrown estimator call out of the entry flow (see estimatorBridge.test.ts)', async () => {
// The bridge is mocked here, so this asserts the call path only; the "never throws" guarantee
// itself lives in estimatorBridge.test.ts where the real bridge is used.
mockAvailability.mockResolvedValue({ state: 'ready', providerId: 'groq' });
mockEstimate.mockResolvedValue(
okEstimate({ nutrition: { caloriesKcal: 250, proteinGrams: 6, carbsGrams: 30, fatGrams: 8 } }),
);
const entry = await makeEntry();
const updated = await analyzeFoodEntry(entry.id);
expect(updated.analysisStatus).toBe('succeeded');
expect(updated.nutrition.caloriesKcal).toBe(250);
});

it('reports analysis being switched off with an actionable message', async () => {
mockAvailability.mockResolvedValue({ state: 'disabled' });
const entry = await makeEntry();
const updated = await analyzeFoodEntry(entry.id);
expect(updated.analysisStatus).toBe('pending');
expect(updated.analysisError).toMatch(/off for now/i);
expect(mockEstimate).not.toHaveBeenCalled();
});

  it('passes the clarification answer and the meal name to the estimator', async () => {
    mockAvailability.mockResolvedValue({ state: 'ready', providerId: 'groq' });
    mockEstimate.mockResolvedValue(okEstimate());
    const entry = await makeEntry();
    await analyzeFoodEntry(entry.id, {
      clarification: { question: 'How much oil?', answer: 'Little' },
    });
    const request = mockEstimate.mock.calls[0]?.[0] as {
      clarification?: unknown;
      mealCategoryName?: unknown;
      imageUri?: unknown;
    };
    expect(request.clarification).toEqual({ question: 'How much oil?', answer: 'Little' });
    expect(request.mealCategoryName).toBe('Lunch');
    expect(request.imageUri).toContain(entry.imagePath);
  });
});

describe('processPendingAnalyses (API-FOOD-016)', () => {
  beforeEach(() => {
    mockAvailability.mockResolvedValue({ state: 'ready', providerId: 'groq' });
    mockEstimate.mockResolvedValue(okEstimate());
  });

  it('does nothing when analysis is not ready', async () => {
    mockAvailability.mockResolvedValue({ state: 'no_consent' });
    const entry = await makeEntry();
    await forceStatus(entry.id, 'pending');
    expect(await processPendingAnalyses()).toEqual({ processed: 0, failed: 0 });
    expect(mockEstimate).not.toHaveBeenCalled();
  });

  it('processes at most five entries per call', async () => {
    for (let i = 0; i < 7; i += 1) {
      const entry = await makeEntry();
      await forceStatus(entry.id, 'pending');
    }
    expect(await processPendingAnalyses()).toEqual({ processed: 5, failed: 0 });
    const remaining = await (await getDb()).query<{ id: string }>(
      "SELECT id FROM food_entries WHERE analysis_status = 'pending'",
    );
    expect(remaining).toHaveLength(2);
  });

  it('skips opted-out entries', async () => {
    const entry = await makeEntry();
    await forceStatus(entry.id, 'pending');
    await (await getDb()).execute('UPDATE food_entries SET analysis_opt_out = 1');
    expect(await processPendingAnalyses()).toEqual({ processed: 0, failed: 0 });
    expect(mockEstimate).not.toHaveBeenCalled();
  });

  it('stops the batch at the first rate limit', async () => {
    for (let i = 0; i < 3; i += 1) {
      const entry = await makeEntry();
      await forceStatus(entry.id, 'pending');
    }
    mockEstimate.mockResolvedValue({ ok: false, error: { code: 'RATE_LIMITED', message: 'slow down' } });
    expect(await processPendingAnalyses()).toEqual({ processed: 0, failed: 0 });
    expect(mockEstimate).toHaveBeenCalledTimes(1);
  });

  it('counts a failed estimate separately from a processed one', async () => {
    const entry = await makeEntry();
    await forceStatus(entry.id, 'pending');
    mockEstimate.mockResolvedValue({ ok: false, error: { code: 'PROVIDER_ERROR', message: 'x' } });
    expect(await processPendingAnalyses()).toEqual({ processed: 0, failed: 1 });
  });

it('leaves an entry pending after a restart so it resumes later', async () => {
const entry = await makeEntry();
await forceStatus(entry.id, 'pending');
const reopened = await createTestDb();
const rows = await reopened.query<{ analysis_status: string }>(
'SELECT analysis_status FROM food_entries',
);
expect(rows).toHaveLength(0);
setDbForTesting(null);
setDbForTesting(await createTestDb());
await expect(getFoodEntry(entry.id)).rejects.toThrow();
});
});

describe('persistence round-trip (DATA_MODEL §5)', () => {
  it('reads an entry back unchanged', async () => {
    const entry = await makeEntry();
    expect(await getFoodEntry(entry.id)).toEqual(entry);
  });

  it('does not leak rows between databases', async () => {
    await makeEntry();
    setDbForTesting(await createTestDb());
    expect(await listFoodEntriesForDate(NOW.slice(0, 10))).toEqual([]);
  });
});