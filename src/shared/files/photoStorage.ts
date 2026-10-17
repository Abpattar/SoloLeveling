/**
 * INTEGRATION CONTRACT: TYPE-FILE-001, TYPE-FILE-002, API-FILE-001 .. API-FILE-009
 * Purpose: the ONLY photo storage in the app besides `src/modules/backup/**`. Photos live in the
 *          app-private document directory under opaque names; the database stores only relative paths.
 * Canonical definition: DATA_MODEL_AND_STORAGE.md §1, SHARED_SYMBOL_REGISTRY.md (FILE area)
 * Consumers: food (A3), photos (A5), backup (A4)
 * Contract status: APPROVED
 */
import { Directory, File, Paths } from 'expo-file-system';
import { AppError, toAppError } from '../errors/AppError';
import { logger } from '../utils/logger';
import type { Id } from '../types/common';

/** TYPE-FILE-001 */
export type PhotoKind = 'food' | 'progress';

/** TYPE-FILE-002 */
export interface StoredPhoto {
  relativePath: string;
  byteSize: number;
}

const ROOT_DIR_NAME = 'private-media';
const STAGING_DIR_NAME = 'private-media-staging';
const SUB_DIRS: readonly PhotoKind[] = ['food', 'progress'];
const NO_MEDIA_MARKER = '.nomedia';

function photoRoot(): Directory {
  return new Directory(Paths.document, ROOT_DIR_NAME);
}

function stagingRoot(): Directory {
  return new Directory(Paths.document, STAGING_DIR_NAME);
}

function ensureDir(dir: Directory): Directory {
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

/** LOCAL-WORKAROUND (internal, this file): creates the root plus both kind folders and `.nomedia`. */
function ensurePhotoTree(root: Directory): Directory {
  ensureDir(root);
  for (const kind of SUB_DIRS) {
    ensureDir(root.createDirectory(kind));
  }
  const marker = new File(root, NO_MEDIA_MARKER);
  if (!marker.exists) {
    try {
      marker.create({ intermediates: true, overwrite: true });
      marker.write('');
    } catch (e) {
      // A missing marker must never block taking photos; log and continue.
      logger.warn('Could not write the private-media marker file.', { error: String(e) });
    }
  }
  return root;
}

/**
 * LOCAL-WORKAROUND (internal, this file): rejects anything that is not a plain relative path under a
 * known kind folder. Blocks `..`, backslashes, absolute paths, and `file://`/`content://` prefixes.
 */
function assertSafeRelativePath(relativePath: string): PhotoKind {
  if (typeof relativePath !== 'string' || relativePath.length === 0) {
    throw new AppError('VALIDATION', 'That photo path is not valid.');
  }
  if (relativePath.includes('\\') || relativePath.includes('..')) {
    throw new AppError('VALIDATION', 'That photo path is not valid.');
  }
  if (relativePath.startsWith('/') || relativePath.includes('://')) {
    throw new AppError('VALIDATION', 'That photo path is not valid.');
  }
  const segments = relativePath.split('/');
  if (segments.length !== 2) {
    throw new AppError('VALIDATION', 'That photo path is not valid.');
  }
  const kind = segments[0] as PhotoKind;
  if (!SUB_DIRS.includes(kind)) {
    throw new AppError('VALIDATION', 'That photo path is not valid.');
  }
  const name = segments[1] as string;
  if (name.length === 0 || name === NO_MEDIA_MARKER) {
    throw new AppError('VALIDATION', 'That photo path is not valid.');
  }
  return kind;
}

function assertValidId(id: Id): void {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(id)) {
    throw new AppError('VALIDATION', 'That photo id is not valid.');
  }
}

/** API-FILE-009 — absolute `file://` URI of the live photo root, WITH a trailing slash. */
export function getPhotoRootUri(): string {
  return `${photoRoot().uri.replace(/\/+$/, '')}/`;
}

/** API-FILE-001 */
export async function savePhotoFromUri(p: {
  kind: PhotoKind;
  id: Id;
  sourceUri: string;
}): Promise<StoredPhoto> {
  assertValidId(p.id);
  if (!SUB_DIRS.includes(p.kind)) {
    throw new AppError('VALIDATION', 'That photo kind is not valid.');
  }
  if (typeof p.sourceUri !== 'string' || p.sourceUri.length === 0) {
    throw new AppError('VALIDATION', 'The captured photo could not be read.');
  }
  try {
    const root = ensurePhotoTree(photoRoot());
    const source = new File(p.sourceUri);
    const target = new File(root.createDirectory(p.kind), `${p.id}.jpg`);
    if (target.exists) {
      target.delete();
    }
    await source.copy(target);
    const stored: StoredPhoto = {
      relativePath: `${p.kind}/${p.id}.jpg`,
      byteSize: target.size,
    };
    try {
      source.delete();
    } catch {
      // The camera temp file may already be gone; that is not a failure of the save.
    }
    return stored;
  } catch (e) {
    throw toAppError(e, 'STORAGE');
  }
}

/** API-FILE-002 */
export function resolvePhotoUri(relativePath: string): string {
  const kind = assertSafeRelativePath(relativePath);
  const name = relativePath.split('/')[1] as string;
  const root = photoRoot();
  return new File(root.createDirectory(kind), name).uri;
}

/** API-FILE-003 — idempotent: a missing file is not an error. */
export async function deletePhoto(relativePath: string): Promise<void> {
  try {
    const kind = assertSafeRelativePath(relativePath);
    const name = relativePath.split('/')[1] as string;
    const file = new File(photoRoot().createDirectory(kind), name);
    if (file.exists) {
      file.delete();
    }
  } catch (e) {
    throw toAppError(e, 'STORAGE');
  }
}

/** API-FILE-004 */
export async function photoExists(relativePath: string): Promise<boolean> {
  try {
    const kind = assertSafeRelativePath(relativePath);
    const name = relativePath.split('/')[1] as string;
    return new File(photoRoot().createDirectory(kind), name).exists;
  } catch {
    return false;
  }
}

/** API-FILE-005 */
export async function listStoredPhotos(): Promise<StoredPhoto[]> {
  const out: StoredPhoto[] = [];
  try {
    const root = photoRoot();
    if (!root.exists) {
      return out;
    }
    for (const kind of SUB_DIRS) {
      const dir = root.createDirectory(kind);
      if (!dir.exists) {
        continue;
      }
      for (const entry of dir.list()) {
        if (entry instanceof Directory) {
          continue;
        }
        const file = entry as File;
        out.push({ relativePath: `${kind}/${file.name}`, byteSize: file.size });
      }
    }
    return out;
  } catch (e) {
    throw toAppError(e, 'STORAGE');
  }
}

/** API-FILE-006 */
export async function prepareStagingPhotoRoot(): Promise<string> {
  try {
    await discardStagingPhotoRoot();
    const staging = ensurePhotoTree(stagingRoot());
    return `${staging.uri.replace(/\/+$/, '')}/`;
  } catch (e) {
    throw toAppError(e, 'STORAGE');
  }
}

/** API-FILE-007 — swaps the live root for the staged one. On failure staging is left intact to retry. */
export async function commitStagingPhotoRoot(): Promise<void> {
  try {
    const live = photoRoot();
    const staging = stagingRoot();
    if (!staging.exists) {
      throw new AppError('STORAGE', 'The prepared backup photos could not be found.');
    }
    if (live.exists) {
      live.delete();
    }
    await staging.move(live);
    ensurePhotoTree(live);
  } catch (e) {
    throw toAppError(e, 'STORAGE');
  }
}

/** API-FILE-008 */
export async function discardStagingPhotoRoot(): Promise<void> {
  try {
    const staging = stagingRoot();
    if (staging.exists) {
      staging.delete();
    }
  } catch (e) {
    throw toAppError(e, 'STORAGE');
  }
}