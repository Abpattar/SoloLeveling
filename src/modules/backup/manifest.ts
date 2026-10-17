/**
 * INTEGRATION CONTRACT: internal (A4 backup)
 * Purpose: the backup folder format. `manifest.json` is written LAST by the exporter, so a folder
 *          without a valid manifest is detectably incomplete and can never be restored by accident.
 * Canonical definition: SHARED_CONTRACT.md §8
 * Consumers: exporter.ts, restorer.ts, manifest.test.ts
 * Contract status: APPROVED (internal symbol, no registry ID)
 */
import { fail, ok } from '@/shared/errors/result';
import { nowIso } from '@/shared/utils/dates';
import type { Result } from '@/shared/types/common';
import type { BackupManifest } from '@/shared/types/backup';

export const BACKUP_FORMAT_VERSION = 1 as const;
export const MANIFEST_FILE_NAME = 'manifest.json';
export const DATA_FILE_NAME = 'data.json';

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** `RecoveryFitness-Backup-YYYYMMDD-HHmmss` (CONTRACT §8). */
export function backupFolderName(now: Date): string {
  return [
    'RecoveryFitness-Backup-',
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('');
}

export function buildManifest(input: {
  appSchemaVersion: number;
  appVersion: string;
  tables: Record<string, number>;
  photoCount: number;
  now?: Date;
}): BackupManifest {
  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    appSchemaVersion: input.appSchemaVersion,
    createdAt: nowIso(),
    appVersion: input.appVersion,
    tables: input.tables,
    photoCount: input.photoCount,
  };
}

function isCountRecord(value: unknown): value is Record<string, number> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0);
}

/** Validates an unknown value read from a folder. Never throws. */
export function validateManifest(raw: unknown): Result<BackupManifest> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return fail('PARSE_ERROR', 'That folder is not a backup this app made.');
  }
  const value = raw as Record<string, unknown>;
  if (value.formatVersion !== BACKUP_FORMAT_VERSION) {
    return fail('UNSUPPORTED', 'That backup was made by a different version of this app.');
  }
  if (typeof value.appSchemaVersion !== 'number' || !Number.isInteger(value.appSchemaVersion)) {
    return fail('UNSUPPORTED', 'That backup does not match this version of the app.');
  }
  if (typeof value.appVersion !== 'string' || typeof value.createdAt !== 'string') {
    return fail('PARSE_ERROR', 'That backup is incomplete or damaged.');
  }
  if (!isCountRecord(value.tables)) {
    return fail('PARSE_ERROR', 'That backup is incomplete or damaged.');
  }
  if (typeof value.photoCount !== 'number' || !Number.isInteger(value.photoCount) || value.photoCount < 0) {
    return fail('PARSE_ERROR', 'That backup is incomplete or damaged.');
  }
  return ok({
    formatVersion: BACKUP_FORMAT_VERSION,
    appSchemaVersion: value.appSchemaVersion,
    createdAt: value.createdAt,
    appVersion: value.appVersion,
    tables: value.tables,
    photoCount: value.photoCount,
  });
}

export interface BackupTables {
  tables: Record<string, Array<Record<string, unknown>>>;
}

/** `data.json` must be `{ "tables": { "<table>": [ {col: value} ] } }`. */
export function validateDataJson(raw: unknown): Result<BackupTables> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return fail('PARSE_ERROR', 'That backup is incomplete or damaged.');
  }
  const tables = (raw as Record<string, unknown>).tables;
  if (typeof tables !== 'object' || tables === null || Array.isArray(tables)) {
    return fail('PARSE_ERROR', 'That backup is incomplete or damaged.');
  }
  for (const rows of Object.values(tables)) {
    if (!Array.isArray(rows)) {
      return fail('PARSE_ERROR', 'That backup is incomplete or damaged.');
    }
    for (const row of rows) {
      if (typeof row !== 'object' || row === null || Array.isArray(row)) {
        return fail('PARSE_ERROR', 'That backup is incomplete or damaged.');
      }
    }
  }
  return ok({ tables: tables as Record<string, Array<Record<string, unknown>>> });
}

/** Only string/number/null column values are accepted; anything else means a damaged backup. */
export function toColumnValue(value: unknown): string | number | null | undefined {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }
  return undefined;
}