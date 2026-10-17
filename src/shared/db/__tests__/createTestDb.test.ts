/** @jest-environment node */
import { createTestDb } from '../testing/createTestDb';
import { DB_SCHEMA_VERSION, DB_TABLES_IN_RESTORE_ORDER, runMigrations } from '../migrations';

describe('createTestDb + migrations', () => {
  it('creates all 12 tables on a fresh in-memory database', async () => {
    const db = await createTestDb();
    const rows = await db.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    const names = rows.map((r) => r.name).filter((n) => !n.startsWith('sqlite_'));
    for (const table of DB_TABLES_IN_RESTORE_ORDER) {
      expect(names).toContain(table);
    }
    expect(names.length).toBe(DB_TABLES_IN_RESTORE_ORDER.length);
  });

  it('reports schema version 1 via PRAGMA user_version', async () => {
    const db = await createTestDb();
    const row = await db.queryOne<{ user_version: number }>('PRAGMA user_version');
    expect(Number(row?.user_version)).toBe(DB_SCHEMA_VERSION);
  });

  it('seeds the four default meal categories', async () => {
    const db = await createTestDb();
    const rows = await db.query<{ id: string }>(
      'SELECT id FROM meal_categories WHERE is_default = 1 ORDER BY sort_order',
    );
    expect(rows.map((r) => r.id)).toEqual([
      'meal-breakfast',
      'meal-lunch',
      'meal-dinner',
      'meal-snacks',
    ]);
  });

  it('is idempotent when migrations run twice', async () => {
    const db = await createTestDb();
    await runMigrations(db);
    const row = await db.queryOne<{ user_version: number }>('PRAGMA user_version');
    expect(Number(row?.user_version)).toBe(DB_SCHEMA_VERSION);
  });

  it('rolls back a failed transaction', async () => {
    const db = await createTestDb();
    await expect(
      db.transaction(async (tx) => {
        await tx.execute(
          'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
          ['app', '{}', 'now'],
        );
        throw new Error('boom');
      }),
    ).rejects.toThrow();
    const rows = await db.query('SELECT * FROM settings');
    expect(rows).toHaveLength(0);
  });
});