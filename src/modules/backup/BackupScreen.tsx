/**
 * INTEGRATION CONTRACT: CMP-BKP-001
 * Purpose: export and restore from one screen. The privacy warning is always visible, restore asks
 *          for explicit confirmation after showing what is in the backup, and local-only data loss is
 *          stated plainly.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CMP-BKP-001), SHARED_CONTRACT §8
 * Consumers: src/app/backup.tsx (A7)
 * Contract status: APPROVED
 */
import React, { useState } from 'react';
import { View } from 'react-native';
// CONST-TEXT-007 (A1) — the fixed, unencrypted-backup warning
import { BACKUP_PRIVACY_WARNING } from '@/shared/constants/text';
// CONTRACT: API-UI-001 (A1) — destructive confirmation
import { confirmAction } from '@/shared/ui/confirmAction';
import { Screen } from '@/shared/ui/Screen';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ErrorBanner } from '@/shared/ui/feedback';
import { useTheme } from '@/shared/ui/theme';
import { toAppError } from '@/shared/errors/AppError';
import { formatDisplayDate } from '@/shared/utils/dates';
import { exportBackup } from './exporter';
import { previewBackup, restoreBackup } from './restorer';
import type { BackupProgress } from '@/shared/types/backup';

export function BackupScreen(): React.JSX.Element {
  const theme = useTheme();
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onExport = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    setMessage(null);
    setProgress({ phase: 'database', done: 0, total: 1 });
    try {
      const result = await exportBackup({ onProgress: setProgress });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      const total = Object.values(result.value.tableRowCounts).reduce<number>((sum, n) => sum + n, 0);
      setMessage(
        `Saved to ${result.value.folderName}: ${total} rows and ${result.value.photoCount} photo${
          result.value.photoCount === 1 ? '' : 's'
        }.`,
      );
    } catch (e) {
      setError(toAppError(e).message);
    } finally {
      setProgress(null);
      setBusy(false);
    }
  };

  const onRestore = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const preview = await previewBackup();
      if (!preview.ok) {
        setError(preview.error.message);
        return;
      }
      const { manifest, folderUri } = preview.value;
      const rows = Object.values(manifest.tables).reduce<number>((sum, n) => sum + n, 0);
      const summary =
        `Backup from ${manifest.appVersion}, made ${formatDisplayDate(manifest.createdAt.slice(0, 10))}: ` +
        `${rows} rows and ${manifest.photoCount} photo${manifest.photoCount === 1 ? '' : 's'}.`;

      const ok = await confirmAction({
        title: 'Replace all current data?',
        message: `${summary}\n\n${BACKUP_PRIVACY_WARNING}`,
        confirmLabel: 'Replace everything',
        destructive: true,
      });
      if (!ok) {
        return;
      }

      setProgress({ phase: 'database', done: 0, total: 1 });
      const result = await restoreBackup(folderUri, { confirmed: true, onProgress: setProgress });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      const restoredRows = Object.values(result.value.restoredTables).reduce<number>((sum, n) => sum + n, 0);
      setMessage(
        `Restored ${restoredRows} rows and ${result.value.restoredPhotoCount} photo${
          result.value.restoredPhotoCount === 1 ? '' : 's'
        }. Food photo analysis is switched off again; turn it on again in Settings if you want it.`,
      );
    } catch (e) {
      setError(toAppError(e).message);
    } finally {
      setProgress(null);
      setBusy(false);
    }
  };

  return (
    <Screen>
      <AppText variant="title">Backup</AppText>
      <Card>
        <AppText style={{ color: theme.colors.warning }}>{BACKUP_PRIVACY_WARNING}</AppText>
        <AppText variant="caption" muted>
          This app keeps everything on this phone only. If you uninstall the app, lose the phone or
          lose the data, anything that was never backed up is gone. Export regularly.
        </AppText>
      </Card>

      <ErrorBanner error={error} />
      {message ? (
        <AppText variant="caption">{message}</AppText>
      ) : null}

      <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
        <Button label="Export backup" onPress={() => void onExport()} loading={busy && progress === null} />
        <Button label="Restore from backup" variant="danger" onPress={() => void onRestore()} disabled={busy} />
      </View>

      {progress ? (
        <AppText variant="caption" muted>
          {progress.phase === 'database'
            ? 'Writing the database…'
            : progress.phase === 'photos'
              ? `Copying photos… ${progress.done} of ${progress.total}`
              : 'Finishing…'}
        </AppText>
      ) : null}
    </Screen>
  );
}