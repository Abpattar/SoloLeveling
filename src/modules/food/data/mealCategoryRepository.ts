/**
 * INTEGRATION CONTRACT: API-FOOD-001 .. API-FOOD-005
 * Purpose: meal categories. The four seeded ones (`meal-breakfast`, `meal-lunch`, `meal-dinner`,
 *          `meal-snacks`) can be renamed but never archived, so no entry can lose its category.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (FOOD area), DATA_MODEL_AND_STORAGE §2
 * Consumers: food screens (A3), reminders (A2), analysisService (A3)
 * Contract status: APPROVED
 */
import { getDb } from '@/shared/db/database';
import { AppError } from '@/shared/errors/AppError';
import { newId } from '@/shared/utils/ids';
import { nowIso } from '@/shared/utils/dates';
import type { Id } from '@/shared/types/common';
import type { MealCategory } from '@/shared/types/food';

interface MealCategoryRow {
  id: string;
  name: string;
  is_default: number;
  sort_order: number;
  archived_at: string | null;
}

function toMealCategory(row: MealCategoryRow): MealCategory {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.is_default === 1,
    sortOrder: Number(row.sort_order),
    archivedAt: row.archived_at,
  };
}

function normalizeName(name: unknown): string {
  if (typeof name !== 'string') {
    throw new AppError('VALIDATION', 'Enter a name for this meal.');
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new AppError('VALIDATION', 'Enter a name for this meal.');
  }
  if (trimmed.length > 30) {
    throw new AppError('VALIDATION', 'A meal name must be 30 characters or fewer.');
  }
  return trimmed;
}

async function loadById(id: Id): Promise<MealCategory> {
  const db = await getDb();
  const row = await db.queryOne<MealCategoryRow>('SELECT * FROM meal_categories WHERE id = ?', [id]);
  if (!row) {
    throw new AppError('NOT_FOUND', 'That meal is no longer in your list.');
  }
  return toMealCategory(row);
}

async function assertNameFree(name: string, exceptId?: Id): Promise<void> {
  const db = await getDb();
  const rows = await db.query<{ id: string; name: string }>(
    'SELECT id, name FROM meal_categories WHERE archived_at IS NULL',
  );
  const target = name.toLowerCase();
  const clash = rows.some(
    (row) => row.id !== exceptId && row.name.trim().toLowerCase() === target,
  );
  if (clash) {
    throw new AppError('VALIDATION', 'You already have a meal with that name.');
  }
}

/** API-FOOD-001 */
export async function listMealCategories(opts?: { includeArchived?: boolean }): Promise<MealCategory[]> {
  const db = await getDb();
  const rows = opts?.includeArchived
    ? await db.query<MealCategoryRow>('SELECT * FROM meal_categories ORDER BY sort_order ASC, name ASC')
    : await db.query<MealCategoryRow>(
        'SELECT * FROM meal_categories WHERE archived_at IS NULL ORDER BY sort_order ASC, name ASC',
      );
  return rows.map(toMealCategory);
}

/** API-FOOD-002 */
export async function createMealCategory(name: string): Promise<MealCategory> {
  const value = normalizeName(name);
  await assertNameFree(value);
  const db = await getDb();
  const next = await db.queryOne<{ next: number }>(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM meal_categories',
  );
  const id = newId();
  await db.execute(
    'INSERT INTO meal_categories (id, name, is_default, sort_order, archived_at) VALUES (?, ?, 0, ?, NULL)',
    [id, value, Number(next?.next ?? 0)],
  );
  return loadById(id);
}

/** API-FOOD-003 */
export async function renameMealCategory(id: Id, name: string): Promise<MealCategory> {
  const value = normalizeName(name);
  await loadById(id);
  await assertNameFree(value, id);
  const db = await getDb();
  await db.execute('UPDATE meal_categories SET name = ? WHERE id = ?', [value, id]);
  return loadById(id);
}

/** API-FOOD-004 — archived categories keep working for their existing entries. */
export async function archiveMealCategory(id: Id): Promise<void> {
  const category = await loadById(id);
  if (category.isDefault) {
    throw new AppError('CONFLICT', 'The built-in meals cannot be archived.');
  }
  const db = await getDb();
  await db.execute('UPDATE meal_categories SET archived_at = ? WHERE id = ?', [nowIso(), id]);
}

/** API-FOOD-005 */
export async function reorderMealCategories(orderedIds: Id[]): Promise<void> {
  const db = await getDb();
  const rows = await db.query<{ id: string }>(
    'SELECT id FROM meal_categories WHERE archived_at IS NULL',
  );
  const existing = new Set(rows.map((r) => r.id));
  const seen = new Set<string>();
  for (const id of orderedIds) {
    if (!existing.has(id) || seen.has(id)) {
      throw new AppError('VALIDATION', 'That meal list could not be reordered.');
    }
    seen.add(id);
  }
  if (seen.size !== existing.size) {
    throw new AppError('VALIDATION', 'That meal list could not be reordered.');
  }
  await db.transaction(async (tx) => {
    for (let index = 0; index < orderedIds.length; index += 1) {
      await tx.execute('UPDATE meal_categories SET sort_order = ? WHERE id = ?', [
        index,
        orderedIds[index],
      ]);
    }
  });
}