/** @jest-environment node */
import { createTestDb } from '@/shared/db/testing/createTestDb';
import { getDb, setDbForTesting } from '@/shared/db/database';
import {
  archiveMealCategory,
  createMealCategory,
  listMealCategories,
  renameMealCategory,
  reorderMealCategories,
} from '../data/mealCategoryRepository';
import { labelForSource } from '../components/NutritionBadge';

beforeEach(async () => {
  setDbForTesting(await createTestDb());
});

afterEach(() => {
  setDbForTesting(null);
});

describe('listMealCategories (API-FOOD-001, GAT-048)', () => {
  it('returns the four seeded meals in order', async () => {
    const categories = await listMealCategories();
    expect(categories.map((c) => c.id)).toEqual([
      'meal-breakfast',
      'meal-lunch',
      'meal-dinner',
      'meal-snacks',
    ]);
    expect(categories.every((c) => c.isDefault)).toBe(true);
  });

  it('hides archived categories unless asked for them', async () => {
    const custom = await createMealCategory('Supper');
    await archiveMealCategory(custom.id);
    expect((await listMealCategories()).some((c) => c.id === custom.id)).toBe(false);
    expect((await listMealCategories({ includeArchived: true })).some((c) => c.id === custom.id)).toBe(
      true,
    );
  });

  it('appends a custom meal at the end', async () => {
    const custom = await createMealCategory('Supper');
    const categories = await listMealCategories();
    expect(categories[categories.length - 1]?.id).toBe(custom.id);
    expect(custom.isDefault).toBe(false);
  });
});

describe('createMealCategory (API-FOOD-002)', () => {
  it('trims the name and keeps the casing the user typed', async () => {
    const custom = await createMealCategory('  Evening Snack  ');
    expect(custom.name).toBe('Evening Snack');
  });

  it('rejects an empty or whitespace-only name', async () => {
    await expect(createMealCategory('')).rejects.toThrow();
    await expect(createMealCategory('   ')).rejects.toThrow();
  });

  it('rejects a name longer than 30 characters', async () => {
    await expect(createMealCategory('x'.repeat(31))).rejects.toThrow();
    expect((await createMealCategory('x'.repeat(30))).name).toHaveLength(30);
  });

  it('rejects a duplicate name, case-insensitively', async () => {
    await expect(createMealCategory('breakfast')).rejects.toThrow();
    await expect(createMealCategory('Lunch')).rejects.toThrow();
    await expect(createMealCategory(' BREAKFAST ')).rejects.toThrow();
  });
});

describe('renameMealCategory (API-FOOD-003)', () => {
  it('renames a custom meal', async () => {
    const custom = await createMealCategory('Supper');
    const renamed = await renameMealCategory(custom.id, 'Late dinner');
    expect(renamed.name).toBe('Late dinner');
    expect(renamed.id).toBe(custom.id);
  });

  it('renames a built-in meal', async () => {
    expect((await renameMealCategory('meal-lunch', 'Midday meal')).name).toBe('Midday meal');
  });

  it('rejects a duplicate or empty name, and an unknown id', async () => {
    const custom = await createMealCategory('Supper');
    await expect(renameMealCategory(custom.id, 'Snacks')).rejects.toThrow();
    await expect(renameMealCategory(custom.id, '')).rejects.toThrow();
    await expect(renameMealCategory('missing', 'X')).rejects.toThrow();
  });

  it('allows a meal to keep its own name', async () => {
    await expect(renameMealCategory('meal-lunch', 'Lunch')).resolves.toBeDefined();
  });
});

describe('archiveMealCategory (API-FOOD-004, GAT-048)', () => {
  it('archives a custom meal', async () => {
    const custom = await createMealCategory('Supper');
    await archiveMealCategory(custom.id);
    expect((await listMealCategories()).some((c) => c.id === custom.id)).toBe(false);
  });

  it('refuses to archive a built-in meal', async () => {
    await expect(archiveMealCategory('meal-breakfast')).rejects.toThrow();
    await expect(archiveMealCategory('meal-snacks')).rejects.toThrow();
    expect(await listMealCategories()).toHaveLength(4);
  });

  it('throws NOT_FOUND for an unknown id', async () => {
    await expect(archiveMealCategory('missing')).rejects.toThrow();
  });

  it('leaves existing entries working after archiving', async () => {
    const custom = await createMealCategory('Supper');
    const db = await getDb();
    await db.execute(
      `INSERT INTO food_entries (id, meal_category_id, image_path, captured_at, local_date, note,
          description, foods_json, portion_text, calories_kcal, protein_g, carbs_g, fat_g,
          nutrition_source, confidence, analysis_status, analysis_opt_out, analysis_provider,
          analysis_error, analyzed_at, clarification_json, created_at, updated_at)
       VALUES ('e1', ?, 'food/e1.jpg', '2026-10-12T12:00:00.000Z', '2026-10-12', NULL, NULL, '[]',
          NULL, NULL, NULL, NULL, NULL, 'none', 'unknown', 'not_requested', 0, NULL, NULL, NULL,
          NULL, '2026-10-12T12:00:00.000Z', '2026-10-12T12:00:00.000Z')`,
      [custom.id],
    );
    await archiveMealCategory(custom.id);
    const rows = await db.query<{ id: string }>('SELECT id FROM food_entries');
    expect(rows).toHaveLength(1);
  });
});

describe('reorderMealCategories (API-FOOD-005)', () => {
  it('rewrites the order', async () => {
    const custom = await createMealCategory('Supper');
    await reorderMealCategories([custom.id, 'meal-breakfast', 'meal-lunch', 'meal-dinner', 'meal-snacks']);
    const categories = await listMealCategories();
    expect(categories.map((c) => c.id)).toEqual([
      custom.id,
      'meal-breakfast',
      'meal-lunch',
      'meal-dinner',
      'meal-snacks',
    ]);
    expect(categories.map((c) => c.sortOrder)).toEqual([0, 1, 2, 3, 4]);
  });

  it('rejects a partial, duplicated or unknown list and changes nothing', async () => {
    const before = (await listMealCategories()).map((c) => c.id);
    await expect(reorderMealCategories(['meal-lunch'])).rejects.toThrow();
    await expect(
      reorderMealCategories(['meal-lunch', 'meal-lunch', 'meal-dinner', 'meal-snacks', 'meal-breakfast']),
    ).rejects.toThrow();
    await expect(
      reorderMealCategories([
        'meal-breakfast',
        'meal-lunch',
        'meal-dinner',
        'meal-snacks',
        'ghost',
      ]),
    ).rejects.toThrow();
    expect((await listMealCategories()).map((c) => c.id)).toEqual(before);
  });
});

describe('NutritionBadge labels (GAT-014)', () => {
  it('uses exactly the four agreed labels', () => {
    expect(labelForSource('ai_estimate')).toBe('AI estimate');
    expect(labelForSource('confirmed')).toBe('Confirmed');
    expect(labelForSource('manual')).toBe('Manual');
    expect(labelForSource('unknown')).toBe('Unknown');
    expect(labelForSource('none')).toBeNull();
  });

  it('never uses wording that implies exactness', () => {
    const labels = [
      labelForSource('ai_estimate'),
      labelForSource('confirmed'),
      labelForSource('manual'),
      labelForSource('unknown'),
    ];
    for (const label of labels) {
      expect((label ?? '').toLowerCase()).not.toMatch(/exact|precise|accurate/);
    }
  });
});