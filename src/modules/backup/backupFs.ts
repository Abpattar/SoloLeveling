/**
 * INTEGRATION CONTRACT: internal (A4 backup) — the ONLY file in the module importing expo-file-system
 * Purpose: every filesystem operation the backup needs, behind an interface so the exporter and the
 *          restorer can be tested against a fake with no device and no native code.
 * Canonical definition: SHARED_CONTRACT.md §8, AGENT_04_PROMPT.md §3
 * Consumers: exporter.ts, restorer.ts
 * Contract status: APPROVED (internal symbol, no registry ID)
 */
import { Directory, File } from 'expo-file-system';
import { toAppError } from '@/shared/errors/AppError';
import type { PhotoKind } from '@/shared/files/photoStorage';

export interface BackupFs {
  /** Opens the Android folder picker. Resolves to null when the user dismisses it. */
  pickDirectory(): Promise<Directory | null>;
  /** Creates (or reuses) `<parent>/<name>` and returns its URI. */
  ensureSubdirectory(parentUri: string, name: string): Promise<string>;
  writeTextFile(directoryUri: string, name: string, contents: string): Promise<void>;
  readTextFile(directoryUri: string, name: string): Promise<string>;
  copyPhotoInto(directoryUri: string, kind: PhotoKind, fileName: string, sourceUri: string): Promise<void>;
  copyPhotoOut(directoryUri: string, kind: PhotoKind, fileName: string, destinationUri: string): Promise<void>;
  listPhotoFiles(directoryUri: string): Promise<string[]>;
  directoryExists(directoryUri: string): Promise<boolean>;
}

class ExpoBackupFs implements BackupFs {
  async pickDirectory(): Promise<Directory | null> {
    try {
      return await Directory.pickDirectoryAsync();
    } catch (e) {
      throw toAppError(e, 'STORAGE');
    }
  }

  async ensureSubdirectory(parentUri: string, name: string): Promise<string> {
    try {
      // A SAF picker returns a content:// directory on Android; a sub-directory is created by name.
      const parent = new Directory(parentUri);
      const child = new Directory(parent, name);
      if (!child.exists) {
        child.create({ intermediates: true, idempotent: true });
      }
      return `${child.uri.replace(/\/+$/, '')}/`;
    } catch (e) {
      throw toAppError(e, 'STORAGE');
    }
  }

  async writeTextFile(directoryUri: string, name: string, contents: string): Promise<void> {
    try {
      const dir = new Directory(directoryUri);
      const file = dir.createFile(name, 'application/json');
      if (file.exists) {
        file.delete();
      }
      file.create({ intermediates: true, overwrite: true });
      file.write(contents);
    } catch (e) {
      throw toAppError(e, 'STORAGE');
    }
  }

  async readTextFile(directoryUri: string, name: string): Promise<string> {
    try {
      return await new File(new Directory(directoryUri), name).text();
    } catch (e) {
      throw toAppError(e, 'STORAGE');
    }
  }

  async copyPhotoInto(
    directoryUri: string,
    kind: PhotoKind,
    fileName: string,
    sourceUri: string,
  ): Promise<void> {
    try {
      const dir = await this.ensureSubdirectory(directoryUri, kind);
      const target = new File(new Directory(dir), fileName);
      if (target.exists) {
        target.delete();
      }
      await new File(sourceUri).copy(target);
    } catch (e) {
      throw toAppError(e, 'STORAGE');
    }
  }

  async copyPhotoOut(
    directoryUri: string,
    kind: PhotoKind,
    fileName: string,
    destinationUri: string,
  ): Promise<void> {
    try {
      const source = new File(new Directory(directoryUri), kind, fileName);
      const target = new File(destinationUri);
      if (target.exists) {
        target.delete();
      }
      await source.copy(target);
    } catch (e) {
      throw toAppError(e, 'STORAGE');
    }
  }

  async listPhotoFiles(directoryUri: string): Promise<string[]> {
    try {
      const dir = new Directory(directoryUri);
      if (!dir.exists) {
        return [];
      }
      return dir
        .list()
        .filter((entry): entry is File => !(entry instanceof Directory))
        .map((file) => file.name);
    } catch {
      return [];
    }
  }

  async directoryExists(directoryUri: string): Promise<boolean> {
    try {
      return new Directory(directoryUri).exists;
    } catch {
      return false;
    }
  }
}

export const backupFs: BackupFs = new ExpoBackupFs();

/** LOCAL-WORKAROUND (internal): tests swap in a fake filesystem. */
let activeFs: BackupFs = backupFs;

export function getBackupFs(): BackupFs {
  return activeFs;
}

export function setBackupFs(next: BackupFs | null): void {
  activeFs = next ?? backupFs;
}