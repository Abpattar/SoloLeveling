/**
 * INTEGRATION CONTRACT: API-DB-001, API-DB-003
 * Purpose: the ONLY file in the app that imports `expo-sqlite`. It adapts the native SDK to the
 *          `Db` interface so every repository stays testable with sql.js.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (API-DB-001, API-DB-003), SHARED_CONTRACT §3.11
 * Consumers: every repository, backup (A4)
 * Contract status: APPROVED
 */
import * as SQLite from 'expo-sqlite';
import { toAppError } from '../errors/AppError';
import { runMigrations } from './migrations';
import type { Db, SqlParam } from './types';

const DATABASE_NAME = 'recovery_fitness.db';

let dbPromise: Promise<Db> | null = null;
let testDb: Db | null = null;

function wrap(db: SQLite.SQLiteDatabase): Db {
  const asDb: Db = {
    async query<T = Record<string, unknown>>(sql: string, params: SqlParam[] = []): Promise<T[]> {
      try {
        return await db.getAllAsync<T>(sql, params);
      } catch (e) {
        throw toAppError(e, 'STORAGE');
      }
    },
    async queryOne<T = Record<string, unknown>>(
      sql: string,
      params: SqlParam[] = [],
    ): Promise<T | null> {
      try {
        return await db.getFirstAsync<T>(sql, params);
      } catch (e) {
        throw toAppError(e, 'STORAGE');
      }
    },
    async execute(sql: string, params: SqlParam[] = []): Promise<{ changes: number }> {
      try {
        const result = await db.runAsync(sql, params);
        return { changes: result.changes };
      } catch (e) {
        throw toAppError(e, 'STORAGE');
      }
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
      try {
        let out: T | undefined;
        await db.withExclusiveTransactionAsync(async (txn) => {
          const txnDb: Db = {
            query: async (sql, params) => asDb.query(sql, params),
            queryOne: async (sql, params) => asDb.queryOne(sql, params),
            execute: async (sql: string, params: SqlParam[] = []) => {
              try {
                const result = await txn.runAsync(sql, params);
                return { changes: result.changes };
              } catch (e) {
                throw toAppError(e, 'STORAGE');
              }
            },
            // Nesting is defined as "just run fn(tx)": the outer transaction owns commit/rollback.
            transaction: async (inner) => inner(txnDb),
          };
          out = await fn(txnDb);
        });
        return out as T;
      } catch (e) {
        throw toAppError(e, 'STORAGE');
      }
    },
  };
  return asDb;
}

async function openOnce(): Promise<Db> {
  try {
    const native = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await native.execAsync('PRAGMA foreign_keys = ON;');
    await native.execAsync('PRAGMA journal_mode = WAL;');
    const db = wrap(native);
    await runMigrations(db);
    return db;
  } catch (e) {
    throw toAppError(e, 'STORAGE');
  }
}

/** API-DB-001 */
export async function getDb(): Promise<Db> {
  if (testDb) {
    return testDb;
  }
  if (!dbPromise) {
    dbPromise = openOnce().catch((e) => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}

/** API-DB-003 */
export function setDbForTesting(db: Db | null): void {
  testDb = db;
}

/** LOCAL-WORKAROUND (A1-owned file, internal helper): drop the memoized connection. Tests only. */
export function resetDbForTesting(): void {
  testDb = null;
  dbPromise = null;
}