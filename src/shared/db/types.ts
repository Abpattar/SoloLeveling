/**
 * INTEGRATION CONTRACT: TYPE-DB-001, TYPE-DB-002
 * Purpose: the ONLY database interface every repository talks to. `expo-sqlite` is imported
 *          exclusively by `src/shared/db/database.ts`; tests substitute a sql.js implementation.
 * Canonical definition: SHARED_CONTRACT.md §3.11
 * Consumers: every repository, backup (A4), createTestDb (A1)
 * Contract status: APPROVED
 */

export type SqlParam = string | number | null;

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: SqlParam[]): Promise<T[]>;
  queryOne<T = Record<string, unknown>>(sql: string, params?: SqlParam[]): Promise<T | null>;
  execute(sql: string, params?: SqlParam[]): Promise<{ changes: number }>;
  /**
   * `tx` is a Db bound to the open transaction. Calling tx.transaction() nests by simply running fn(tx).
   * Rolls back on throw.
   */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
}