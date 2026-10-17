/**
 * INTEGRATION CONTRACT: CMP-BKP-002
 * Purpose: the Settings row that leads to the backup screen, with the privacy warning visible before
 *          the user even taps it.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CMP-BKP-002)
 * Consumers: src/shell/SettingsScreen.tsx (A7)
 * Contract status: APPROVED
 */
import React from 'react';
import { router } from 'expo-router';
// CONST-TEXT-007 (A1) — the fixed, unencrypted-backup warning
import { BACKUP_PRIVACY_WARNING } from '@/shared/constants/text';
// CONTRACT: CONST-NAV-001 (A1) — route builder
import { ROUTES } from '@/shared/navigation/routes';
import { Card } from '@/shared/ui/Card';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';

export function BackupSettingsSection(): React.JSX.Element {
  return (
    <Card>
      <AppText variant="heading" style={{ marginBottom: 0 }}>
        Backup
      </AppText>
      <AppText variant="caption" muted>
        {BACKUP_PRIVACY_WARNING}
      </AppText>
      <Button label="Open backup" variant="secondary" onPress={() => router.push(ROUTES.backup)} />
    </Card>
  );
}