/**
 * INTEGRATION CONTRACT: CMP-SHELL-003 (section 6 of 9)
 * Purpose: the one display toggle the app owns. Hiding estimates hides calorie and protein numbers
 *          everywhere; the toggle never hides the disclaimer that explains what an estimate is.
 * Canonical definition: SHARED_CONTRACT.md §5, REQ-ACT-004
 * Consumers: src/shell/SettingsScreen.tsx
 * Contract status: APPROVED
 */
import React, { useState } from 'react';
import { Switch, View } from 'react-native';
// CONTRACT: HOOK-SET-001 (A1) - settings read/write
import { useSettings } from '@/shared/settings/SettingsProvider';
// CONTRACT: API-CORE-002 (A1) - readable failure messages
import { toAppError } from '@/shared/errors/AppError';
// CONTRACT: CONST-TEXT-004 (A1) - the fixed estimate disclaimer
import { ESTIMATE_DISCLAIMER_TEXT } from '@/shared/constants/text';
// CONTRACT: CMP-UI-002/004/014 (A1)
import { Card } from '@/shared/ui/Card';
import { AppText } from '@/shared/ui/AppText';
import { ErrorBanner } from '@/shared/ui/feedback';
import { useTheme } from '@/shared/ui/theme';

export function DisplaySection(): React.JSX.Element {
  const theme = useTheme();
  const { settings, update } = useSettings();
  const [error, setError] = useState<string | null>(null);

  const toggle = async (value: boolean): Promise<void> => {
    setError(null);
    try {
      await update({ display: { showCalorieEstimates: value } });
    } catch (e) {
      setError(toAppError(e).message);
    }
  };

  return (
    <Card>
      <AppText variant="heading" style={{ marginBottom: 0 }}>
        Display
      </AppText>
      <ErrorBanner error={error} />

      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing.sm }}>
        <AppText style={{ flex: 1 }}>Show calorie estimates</AppText>
        <Switch
          accessibilityRole="switch"
          accessibilityLabel="Show calorie estimates"
          value={settings.display.showCalorieEstimates}
          onValueChange={(next) => void toggle(next)}
        />
      </View>
      <AppText variant="caption" muted>
        {ESTIMATE_DISCLAIMER_TEXT}
      </AppText>
    </Card>
  );
}
