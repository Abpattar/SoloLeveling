/**
 * INTEGRATION CONTRACT: API-BKP-002, API-BKP-003
 * Purpose: restore everything from a backup folder. The order is the whole safety story:
 *          validate the manifest, the schema version, the data shape and every referenced photo
 *          BEFORE touching anything; stage the photos; replace the database in one transaction;
 *          commit the photo root; reset AI consent; emit `data.restored`. Any failure leaves the
 *          existing data exactly as it was.
 * Canonical definition: SHARED_CONTRACT.md Â§8, ERROR_HANDLING_AND_SECURITY SEC-13
 * Consumers: BackupScreen.tsx (A4)
 * Contract status: APPROVED
 */
import { getDb } from '@/shared/db/database';
import { fail, ok } from '@/shared/errors/result';
import { toAppError } from '@/shared/errors/AppError';
import { appEvents } from '@/shared/events/appEvents';
import {
  commitStagingPhotoRoot,
  discardStagingPhotoRoot,
  prepareStagingPhotoRoot,
} from '@/shared/files/photoStorage';
import { resetAiConsent } from '@/shared/settings/settingsRepository';
import { DB_SCHEMA_VERSION, DB_TABLES_IN_RESTORE_ORDER } from '@/shared/db/migrations';
import { logger } from '@/shared/utils/logger';
import { getBackupFs } from './backupFs';
import {
  DATA_FILE_NAME,
  MANIFEST_FILE_NAME,
  toColumnValue,
  validateDataJson,
  validateManifest,
} from './manifest';
import type { Result } from '@/shared/types/common';
import type { BackupManifest, BackupProgress, RestoreResult } from '@/shared/types/backup';

export interface RestoreOptions {
  confirmed: boolean;
  onProgress?: (p: BackupProgress) => void;
}

async function readJson(fs: ReturnType<typeof getBackupFs>, folderUri: string, name: string): Promise<unknown> {
  const text = await fs.readTextFile(folderUri, name);
  return JSON.parse(text);
}

/** API-BKP-002 â€” opens the picker and validates the folder without changing anything. */
export async function previewBackup(): Promise<
  Result<{ manifest: BackupManifest; folderUri: string }>
> {
  try {
    const fs = getBackupFs();
    const picked = await fs.pickDirectory();
    if (picked === null) {
      return fail('CANCELLED', 'No folder was chosen.');
    }
    const folderUri = `${picked.uri.replace(/\/+$/, '')}/`;
    const manifest = validateManifest(await readJson(fs, folderUri, MANIFEST_FILE_NAME));
    if (!manifest.ok) {
      return manifest;
    }
    return ok({ manifest: manifest.value, folderUri });
  } catch (e) {
    return fail('PARSE_ERROR', toAppError(e, 'STORAGE').message);
  }
}

async function collectReferencedPhotos(
  tables: Record<string, Array<Record<string, unknown>>>,
): Promise<string[]> {
  const paths = new Set<string>();
  for (const table of ['food_entries', 'progress_photos']) {
    const rows = tables[table] ?? [];
    for (const row of rows) {
      const value = row.image_path;
      if (typeof value === 'string' && value.length > 0) {
        paths.add(value);
      }
    }
  }
  return Array.from(paths);
}

/** API-BKP-003 */
export async function restoreBackup(
  folderUri: string,
  options: RestoreOptions,
): Promise<Result<RestoreResult>> {
  if (options?.confirmed !== true) {
    return fail('VALIDATION', 'Restoring replaces everything. Confirm first.');
  }

  const fs = getBackupFs();
  let stagingPrepared = false;

  try {
    // Step 1: validate everything before touching a single row.
    const manifest = validateManifest(await readJson(fs, folderUri, MANIFEST_FILE_NAME));
    if (!manifest.ok) {
      return manifest;
    }
    if (manifest.value.appSchemaVersion !== DB_SCHEMA_VERSION) {
      return fail(
        'UNSUPPORTED',
        'That backup was made by a different version of the app and cannot be restored safely.',
      );
    }

    const data = validateDataJson(await readJson(fs, folderUri, DATA_FILE_NAME));
    if (!data.ok) {
      return data;
    }
    const tables = data.value.tables;

    for (const table of DB_TABLES_IN_RESTORE_ORDER) {
      if (tables[table] === undefined) {
        return fail('PARSE_ERROR', 'That backup is incomplete and was not finished.');
      }
    }

    const photoPaths = await collectReferencedPhotos(tables);
    options.onProgress?.({ phase: 'photos', done: 0, total: photoPaths.length });
    for (const relativePath of photoPaths) {
      const kind = relativePath.split('/')[0] as 'food' | 'progress';
      const fileName = (relativePath.split('/')[1] ?? '') as string;
      if (kind !== 'food' && kind !== 'progress') {
        return fail('PARSE_ERROR', 'That backup refers to a photo this app does not recognise.');
      }
      const present = await fs.listPhotoFiles(`${folderUri}photos/${kind}/`);
      if (!present.includes(fileName)) {
        return fail('PARSE_ERROR', 'That backup is missing a photo, so it was not restored.');
      }
    }

    // Step 2: stage the photos. Nothing live has changed yet. Prepared exactly ONCE, because
    // preparing again would clear the directory that already holds the staged photos.
    const stagingRoot = (await prepareStagingPhotoRoot()).replace(/\/+\$/, '');
    stagingPrepared = true;
    for (let i = 0; i < photoPaths.length; i += 1) {
      const relativePath = photoPaths[i] as string;
      const kind = relativePath.split('/')[0] as 'food' | 'progress';
      const fileName = (relativePath.split('/')[1] ?? '') as string;
      await fs.copyPhotoOut(
        `${folderUri}photos/${kind}/`,
        kind,
        fileName,
        `${stagingRoot}/${kind}/${fileName}`,
      );
      options.onProgress?.({ phase: 'photos', done: i + 1, total: photoPaths.length });
    }

    // Step 3: one transaction. Any failure rolls back and leaves the old data in place.
    options.onProgress?.({ phase: 'database', done: 0, total: DB_TABLES_IN_RESTORE_ORDER.length });
    const db = await getDb();
    const restoredTables: Record<string, number> = {};
    await db.transaction(async (tx) => {
      for (const table of [...DB_TABLES_IN_RESTORE_ORDER].reverse()) {
        await tx.execute(`DELETE FROM ${table}`);
      }
      let index = 0;
      for (const table of DB_TABLES_IN_RESTORE_ORDER) {
        const rows = tables[table] ?? [];
        for (const row of rows) {
          const columns = Object.keys(row);
          if (columns.length === 0) {
            continue;
          }
          const values: Array<string | number | null> = [];
          let usable = true;
          for (const column of columns) {
            const value = toColumnValue(row[column]);
            if (value === undefined) {
              usable = false;
              break;
            }
            values.push(value);
          }
          if (!usable) {
            throw toAppError(
              new Error('A row in the backup holds a value this app cannot store.'),
              'PARSE_ERROR',
            );
          }
          const placeholders = columns.map(() => '?').join(', ');
          // Column names come from the backup file; they are validated against the live schema.
          await tx.execute(
            `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
            values,
          );
        }
        restoredTables[table] = rows.length;
        index += 1;
        options.onProgress?.({ phase: 'database', done: index, total: DB_TABLES_IN_RESTORE_ORDER.length });
      }
    });

    // Step 4: swap the photo root, then reset consent, then tell the app to reload.
    await commitStagingPhotoRoot();
    stagingPrepared = false;
    await resetAiConsent();
    options.onProgress?.({ phase: 'finalizing', done: 1, total: 1 });

    appEvents.emit('data.restored', {});
    return ok({ restoredTables, restoredPhotoCount: photoPaths.length });
  } catch (e) {
    if (stagingPrepared) {
      try {
        await discardStagingPhotoRoot();
      } catch {
        // Nothing was committed, so the live photos are still the originals.
      }
    }
    logger.warn('The backup restore did not finish.', { error: String(toAppError(e)) });
    const error = toAppError(e, 'STORAGE');
    return fail(error.code, error.message);
  }
}

