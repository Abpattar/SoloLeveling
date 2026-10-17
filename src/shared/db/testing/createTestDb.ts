/**
 * INTEGRATION CONTRACT: API-DB-004
 * Purpose: in-memory `sql.js` implementation of `Db` so every repository can be unit-tested
 *          without a device. TEST ONLY — production code must never import this file.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (API-DB-004), SHARED_CONTRACT §11
 * Consumers: every module's repository tests
 * Contract status: APPROVED
 */
import * as path from 'node:path';
import initSqlJs from 'sql.js';
import type { Database, SqlJsStatic, SqlValue } from 'sql.js';
import { toAppError } from '../../errors/AppError';
import { runMigrations } from '../migrations';
import type { Db, SqlParam } from '../types';

let sqlPromise: Promise<SqlJsStatic> | null = null;

async function getSqlJs(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      // Resolve the .wasm next to the installed package so tests need no network and no native build.
      locateFile: (file: string) => path.join(__dirname, '..', '..', '..', '..', 'node_modules', 'sql.js', 'dist', file),
    });
  }
  return sqlPromise;
}

type Row = Record<string, unknown>;

function toParams(params: SqlParam[]): SqlValue[] {
  return params.map((value) => (value === undefined ? null : value)) as SqlValue[];
}

function createDb(database: Database): Db {
  let inTransaction = false;

  const base: Db = {
    async query<T = Row>(sql: string, params: SqlParam[] = []): Promise<T[]> {
      try {
        const stmt = database.prepare(sql);
        try {
          stmt.bind(toParams(params));
          const rows: T[] = [];
          while (stmt.step()) {
            rows.push(stmt.getAsObject() as T);
          }
          return rows;
        } finally {
          stmt.free();
        }
      } catch (e) {
        throw toAppError(e, 'STORAGE');
      }
    },
    async queryOne<T = Row>(sql: string, params: SqlParam[] = []): Promise<T | null> {
      const rows = await base.query<T>(sql, params);
      return rows.length > 0 ? rows[0] : null;
    },
    async execute(sql: string, params: SqlParam[] = []): Promise<{ changes: number }> {
      try {
        database.run(sql, toParams(params));
        // sql.js has no `changes` in run(); `SELECT changes()` returns the last statement's count.
        const stmt = database.prepare('SELECT changes() AS c');
        stmt.step();
        const row = stmt.getAsObject() as { c: number };
        stmt.free();
        return { changes: Number(row.c) };
      } catch (e) {
        throw toAppError(e, 'STORAGE');
      }
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
      if (inTransaction) {
        // Nesting is defined as "just run fn(tx)".
        return fn(base);
      }
      try {
        database.exec('BEGIN');
        inTransaction = true;
        const out = await fn(base);
        database.exec('COMMIT');
        return out;
      } catch (e) {
        try {
          database.exec('ROLLBACK');
        } catch {
          // A rollback failure must not mask the original error.
        }
        throw toAppError(e, 'STORAGE');
      } finally {
        inTransaction = false;
      }
    },
  };

  return base;
}

/** API-DB-004 */
export async function createTestDb(): Promise<Db> {
  const SQL = await getSqlJs();
  const database = new SQL.Database();
  database.exec('PRAGMA foreign_keys = ON;');
  const db = createDb(database);
  await runMigrations(db);
  return db;
}