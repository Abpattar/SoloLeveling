/**
 * INTEGRATION CONTRACT: CMP-SHELL-003 (section 9 of 9)
 * Purpose: the fixed legal and safety text, plus the version. Every disclaimer here is a verbatim
 *          CONST-TEXT constant; none of it may be reworded or shortened.
 * Canonical definition: SHARED_CONTRACT.md §5, §6 (CONST-TEXT-001/004/005)
 * Consumers: src/shell/SettingsScreen.tsx
 * Contract status: APPROVED
 */
import React from 'react';
import Constants from 'expo-constants';
// CONTRACT: CONST-TEXT-001/004/005 (A1) - verbatim fixed text, never reworded
import {
  ESTIMATE_DISCLAIMER_TEXT,
  HEALTH_DISCLAIMER_TEXT,
  LOCK_NOTE_TEXT,
} from '@/shared/constants/text';
// CONTRACT: CMP-UI-002/004 (A1)
import { Card } from '@/shared/ui/Card';
import { AppText } from '@/shared/ui/AppText';

function readVersion(): string {
  const version = Constants.expoConfig?.version;
  return typeof version === 'string' && version.length > 0 ? version : 'unknown';
}

export function AboutSection(): React.JSX.Element {
  return (
    <Card>
      <AppText variant="heading" style={{ marginBottom: 0 }}>
        About
      </AppText>

      <AppText variant="caption" muted>
        Version {readVersion()}
      </AppText>
      <AppText variant="caption" muted>
        Data stays on this device unless you enable photo analysis or export a backup.
      </AppText>

      <AppText variant="label" style={{ marginTop: 8 }}>
        Medical disclaimer
      </AppText>
      <AppText variant="caption" muted>
        {HEALTH_DISCLAIMER_TEXT}
      </AppText>

      <AppText variant="label" style={{ marginTop: 8 }}>
        Photo locking
      </AppText>
      <AppText variant="caption" muted>
        {LOCK_NOTE_TEXT}
      </AppText>

      <AppText variant="label" style={{ marginTop: 8 }}>
        Estimates
      </AppText>
      <AppText variant="caption" muted>
        {ESTIMATE_DISCLAIMER_TEXT}
      </AppText>
    </Card>
  );
}
