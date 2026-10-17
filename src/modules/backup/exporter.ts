/**
 * INTEGRATION CONTRACT: API-BKP-001
 * Purpose: writes every table and every photo into a user-chosen folder. The manifest is written
 *          LAST, so an interrupted export is detectably incomplete. API keys are never exported.
 * Canonical definition: SHARED_CONTRACT.md §8
 * Consumers: BackupScreen.tsx (A4)
 * Contract status: APPROVED
 */
import ExpoConstants from 'expo-constants';
import { getDb } from '@/shared/db/database';
import { fail, ok } from '@/shared/errors/result';
import { toAppError } from '@/shared/errors/AppError';
import { listStoredPhotos, resolvePhotoUri } from '@/shared/files/photoStorage';
import { DB_SCHEMA_VERSION, DB_TABLES_IN_RESTORE_ORDER } from '@/shared/db/migrations';
import { logger } from '@/shared/utils/logger';
import { getBackupFs } from './backupFs';
import {
  backupFolderName,
  buildManifest,
  DATA_FILE_NAME,
  MANIFEST_FILE_NAME,
} from './manifest';
import type { Result } from '@/shared/types/common';
import type { BackupExportResult, BackupProgress } from '@/shared/types/backup';

export interface ExportOptions {
  onProgress?: (p: BackupProgress) => void;
}

function appVersion(): string {
  const version: unknown = ExpoConstants.expoConfig?.version;
  return typeof version === 'string' && version.length > 0 ? version : '1.0.0';
}

function progress(options: ExportOptions | undefined, phase: BackupProgress['phase'], done: number, total: number): void {
  options?.onProgress?.({ phase, done, total });
}

/** API-BKP-001 */
export async function exportBackup(options?: ExportOptions): Promise<Result<BackupExportResult>> {
  try {
    const fs = getBackupFs();
    const picked = await fs.pickDirectory();
    if (picked === null) {
      return fail('CANCELLED', 'No folder was chosen.');
    }

    const folderName = backupFolderName(new Date());
    const folderUri = await fs.ensureSubdirectory(picked.uri, folderName);

    // Phase 1: every table, as raw rows. No secrets live in SQLite, so nothing is filtered here.
    const db = await getDb();
    const tables: Record<string, Array<Record<string, unknown>>> = {};
    const rowCounts: Record<string, number> = {};
    let tableIndex = 0;
    for (const table of DB_TABLES_IN_RESTORE_ORDER) {
      // The table name comes from our own constant list, never from user input.
      const rows = await db.query<Record<string, unknown>>(`SELECT * FROM ${table}`);
      tables[table] = rows;
      rowCounts[table] = rows.length;
      tableIndex += 1;
      progress(options, 'database', tableIndex, DB_TABLES_IN_RESTORE_ORDER.length);
    }
    await fs.writeTextFile(folderUri, DATA_FILE_NAME, JSON.stringify({ tables }));

    // Phase 2: photos.
    const photos = await listStoredPhotos();
    let photoIndex = 0;
    let totalBytes = 0;
    for (const photo of photos) {
      const kind = photo.relativePath.split('/')[0] as 'food' | 'progress';
      const fileName = (photo.relativePath.split('/')[1] ?? '') as string;
      await fs.copyPhotoInto(`${folderUri}photos/`, kind, fileName, resolvePhotoUri(photo.relativePath));
      totalBytes += photo.byteSize;
      photoIndex += 1;
      progress(options, 'photos', photoIndex, photos.length);
    }

    // Phase 3: manifest last, so an interrupted export has no manifest and cannot be restored.
    const manifest = buildManifest({
      appSchemaVersion: DB_SCHEMA_VERSION,
      appVersion: appVersion(),
      tables: rowCounts,
      photoCount: photos.length,
    });
    progress(options, 'finalizing', 0, 1);
    await fs.writeTextFile(folderUri, MANIFEST_FILE_NAME, JSON.stringify(manifest, null, 2));
    progress(options, 'finalizing', 1, 1);

    return ok({
      folderName,
      tableRowCounts: rowCounts,
      photoCount: photos.length,
      totalBytes,
    });
  } catch (e) {
    logger.warn('The backup export did not finish.', { error: String(toAppError(e)) });
    return fail(toAppError(e, 'STORAGE').code, toAppError(e, 'STORAGE').message);
  }
}