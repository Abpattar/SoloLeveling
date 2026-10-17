/** @jest-environment node */
import { createTestDb } from '@/shared/db/testing/createTestDb';
import { getDb, setDbForTesting } from '@/shared/db/database';
import { getDailyNutritionTotals, getNutritionTotalsForRange } from '../domain/totals';
import { listMealCategories } from '../data/mealCategoryRepository';
import { updateAnalysisColumns, getFoodEntryRow } from '../data/foodRepository';
import type { Id } from '@/shared/types/common';
import type { NutritionSource } from '@/shared/types/food';

const DATE = '2026-10-12';
let counter = 0;

async function insertEntry(
  overrides: {
    source: NutritionSource;
    calories: number | null;
    protein?: number | null;
    carbs?: number | null;
    fat?: number | null;
    mealCategoryId?: Id;
    date?: string;
  },
): Promise<Id> {
  counter += 1;
  const id = `entry-${counter}`;
  const nutrition = overrides.source === 'none' || overrides.source === 'unknown' ? 'unknown' : overrides.source;
  const db = await getDb();
  await db.execute(
    `INSERT INTO food_entries (id, meal_category_id, image_path, captured_at, local_date, note,
        description, foods_json, portion_text, calories_kcal, protein_g, carbs_g, fat_g,
        nutrition_source, confidence, analysis_status, analysis_opt_out, analysis_provider,
        analysis_error, analyzed_at, clarification_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NULL, NULL, '[]', NULL, ?, ?, ?, ?, ?, 'unknown', 'not_requested', 0,
        NULL, NULL, NULL, NULL, ?, ?)`,
    [
      id,
      overrides.mealCategoryId ?? 'meal-lunch',
      `food/${id}.jpg`,
      `${overrides.date ?? DATE}T12:00:00.000Z`,
      overrides.date ?? DATE,
      overrides.calories,
      overrides.protein === undefined ? 10 : overrides.protein,
      overrides.carbs ?? null,
      overrides.fat ?? null,
      nutrition,
      `${DATE}T12:00:00.000Z`,
      `${DATE}T12:00:00.000Z`,
    ],
  );
  return id;
}

beforeEach(async () => {
  setDbForTesting(await createTestDb());
  counter = 0;
});

afterEach(() => {
  setDbForTesting(null);
});

describe('getDailyNutritionTotals (API-FOOD-017)', () => {
  it('returns zeros for an empty day', async () => {
    const totals = await getDailyNutritionTotals(DATE);
    expect(totals.total).toEqual({
      caloriesKcal: 0,
      proteinGrams: 0,
      carbsGrams: null,
      fatGrams: null,
    });
    expect(totals.entryCount).toBe(0);
    expect(totals.entriesWithoutValues).toBe(0);
    expect(totals.mealSubtotals).toEqual([]);
  });

  it('counts only ai_estimate, confirmed and manual entries', async () => {
    await insertEntry({ source: 'ai_estimate', calories: 400, protein: 10 });
    await insertEntry({ source: 'confirmed', calories: 300, protein: 20 });
    await insertEntry({ source: 'manual', calories: 200, protein: 5 });
    await insertEntry({ source: 'none', calories: 999 });
    await insertEntry({ source: 'unknown', calories: 999 });

    const totals = await getDailyNutritionTotals(DATE);
    expect(totals.total.caloriesKcal).toBe(900);
    expect(totals.total.proteinGrams).toBe(35);
    expect(totals.entryCount).toBe(5);
    expect(totals.entriesWithoutValues).toBe(2);
  });

  it('counts an entry with a counted source but no calories as without values', async () => {
    await insertEntry({ source: 'manual', calories: null });
    const totals = await getDailyNutritionTotals(DATE);
    expect(totals.entryCount).toBe(1);
    expect(totals.entriesWithoutValues).toBe(1);
    expect(totals.total.caloriesKcal).toBe(0);
  });

  it('splits totals by source', async () => {
    await insertEntry({ source: 'ai_estimate', calories: 400, protein: 10 });
    await insertEntry({ source: 'confirmed', calories: 300, protein: 20 });
    const totals = await getDailyNutritionTotals(DATE);
    expect(totals.bySource.ai_estimate.caloriesKcal).toBe(400);
    expect(totals.bySource.confirmed.caloriesKcal).toBe(300);
    expect(totals.bySource.manual.caloriesKcal).toBe(0);
  });

  it('groups meal subtotals by category with entry counts', async () => {
    await insertEntry({ source: 'manual', calories: 300, mealCategoryId: 'meal-breakfast' });
    await insertEntry({ source: 'manual', calories: 200, mealCategoryId: 'meal-breakfast' });
    await insertEntry({ source: 'manual', calories: 100, mealCategoryId: 'meal-dinner' });

    const totals = await getDailyNutritionTotals(DATE);
    expect(totals.mealSubtotals).toHaveLength(2);
    const breakfast = totals.mealSubtotals.find((s) => s.mealCategoryId === 'meal-breakfast');
    expect(breakfast?.entryCount).toBe(2);
    expect(breakfast?.total.caloriesKcal).toBe(500);
  });

  it('leaves carbs and fat null when no entry supplied them', async () => {
    await insertEntry({ source: 'manual', calories: 300, carbs: null, fat: null });
    const totals = await getDailyNutritionTotals(DATE);
    expect(totals.total.carbsGrams).toBeNull();
    expect(totals.total.fatGrams).toBeNull();
  });

  it('ignores entries from other days', async () => {
    await insertEntry({ source: 'manual', calories: 300 });
    await insertEntry({ source: 'manual', calories: 900, date: '2026-10-13' });
    expect((await getDailyNutritionTotals(DATE)).total.caloriesKcal).toBe(300);
  });

  it('rejects an invalid date', async () => {
    await expect(getDailyNutritionTotals('2026-02-30')).rejects.toThrow();
  });
});

describe('getNutritionTotalsForRange (API-FOOD-018)', () => {
  it('returns one element per date, empty days included', async () => {
    await insertEntry({ source: 'manual', calories: 500, date: '2026-10-12' });
    const range = await getNutritionTotalsForRange('2026-10-11', '2026-10-13');
    expect(range.map((r) => r.localDate)).toEqual(['2026-10-11', '2026-10-12', '2026-10-13']);
    expect(range[0]?.total.caloriesKcal).toBe(0);
    expect(range[1]?.total.caloriesKcal).toBe(500);
    expect(range[2]?.total.caloriesKcal).toBe(0);
  });

  it('crosses month and year boundaries', async () => {
    const range = await getNutritionTotalsForRange('2026-12-30', '2027-01-02');
    expect(range.map((r) => r.localDate)).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ]);
  });

  it('handles a leap day', async () => {
    const range = await getNutritionTotalsForRange('2024-02-28', '2024-03-01');
    expect(range.map((r) => r.localDate)).toEqual([
      '2024-02-28',
      '2024-02-29',
      '2024-03-01',
    ]);
  });

  it('rejects a reversed range and invalid dates', async () => {
    await expect(getNutritionTotalsForRange('2026-10-13', '2026-10-11')).rejects.toThrow();
    await expect(getNutritionTotalsForRange('2026-02-30', '2026-03-01')).rejects.toThrow();
  });
});

describe('integration with the meal list', () => {
  it('uses the archived category ids that still exist on entries', async () => {
    const categories = await listMealCategories();
    expect(categories.map((c) => c.id)).toEqual([
      'meal-breakfast',
      'meal-lunch',
      'meal-dinner',
      'meal-snacks',
    ]);
  });

  it('reflects a nutrition update in the totals on the next read', async () => {
    const id = await insertEntry({ source: 'manual', calories: 100, protein: 5 });
    expect((await getDailyNutritionTotals(DATE)).total.caloriesKcal).toBe(100);

    await updateAnalysisColumns(id, {
      analysisStatus: 'succeeded',
      nutrition: { caloriesKcal: 450, proteinGrams: 20, carbsGrams: null, fatGrams: null },
      nutritionSource: 'confirmed',
    });

    expect((await getDailyNutritionTotals(DATE)).total.caloriesKcal).toBe(450);
    const row = await getFoodEntryRow(id);
    expect(row.nutrition_source).toBe('confirmed');
  });
});