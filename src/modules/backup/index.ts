/**
 * INTEGRATION CONTRACT: module index for `@/modules/backup`
 * Purpose: the ONLY public surface of the backup module.
 * Consumers: src/app/backup.tsx, src/shell/SettingsScreen.tsx (A7)
 * Contract status: APPROVED
 */

// API-BKP-001..003
export { exportBackup } from './exporter';
export { previewBackup, restoreBackup } from './restorer';

// CMP-BKP-001/002
export { BackupScreen } from './BackupScreen';
export { BackupSettingsSection } from './BackupSettingsSection';

// LOCAL-WORKAROUND (A4): test-only filesystem injection, exported so the backup tests can use it
// without reaching into internals.
export { setBackupFs } from './backupFs';
export type { BackupFs } from './backupFs';