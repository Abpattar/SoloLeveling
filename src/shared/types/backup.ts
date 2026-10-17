/**
 * INTEGRATION CONTRACT: TYPE-BKP-001 .. TYPE-BKP-004
 * Purpose: backup folder manifest and export/restore results (folder format v1, unencrypted).
 * Canonical definition: SHARED_CONTRACT.md §3.9
 * Consumers: backup (A4)
 * Contract status: APPROVED
 */
import type { IsoDateTime } from './common';

export interface BackupManifest {
  formatVersion: 1;
  appSchemaVersion: number;
  createdAt: IsoDateTime;
  appVersion: string;
  tables: Record<string, number>;
  photoCount: number;
}

export interface BackupExportResult {
  folderName: string;
  tableRowCounts: Record<string, number>;
  photoCount: number;
  totalBytes: number;
}

export interface RestoreResult {
  restoredTables: Record<string, number>;
  restoredPhotoCount: number;
}

export interface BackupProgress {
  phase: 'database' | 'photos' | 'finalizing';
  done: number;
  total: number;
}