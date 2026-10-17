/**
 * INTEGRATION CONTRACT: CMP-SHELL-003 (section 7 of 9)
 * Purpose: the symptom alert level the user optionally sets. The app NEVER chooses this number: an
 *          empty field is the correct state for most people, and clearing it is a first-class action.
 * Canonical definition: SHARED_CONTRACT.md §5, REQ-SES-004
 * Consumers: src/shell/SettingsScreen.tsx
 * Contract status: APPROVED
 */
import React, { useState } from 'react';
import { View } from 'react-native';
// CONTRACT: HOOK-SET-001 (A1) - settings read/write
import { useSettings } from '@/shared/settings/SettingsProvider';
// CONTRACT: API-CORE-002 (A1) - readable failure messages
import { toAppError } from '@/shared/errors/AppError';
// CONTRACT: CMP-UI-002..006/014 (A1)
import { Card } from '@/shared/ui/Card';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { NumberField } from '@/shared/ui/fields';
import { ErrorBanner } from '@/shared/ui/feedback';
import { useTheme } from '@/shared/ui/theme';

const HELPER_TEXT =
  'Only set this if your clinician gave you a number. The app never chooses one for you.';
const RANGE_ERROR = 'Use a whole number from 0 to 10, or leave it empty to clear.';

export function SafetySection(): React.JSX.Element {
  const theme = useTheme();
  const { settings, update } = useSettings();
  const [error, setError] = useState<string | null>(null);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stored = settings.safety.painAlertLevel;
  const [draft, setDraft] = useState<number | null>(stored);

  const save = async (value: number | null): Promise<void> => {
    setBusy(true);
    setError(null);
    setRangeError(null);
    try {
      if (value !== null && (!Number.isInteger(value) || value < 0 || value > 10)) {
        setRangeError(RANGE_ERROR);
        return;
      }
      await update({ safety: { painAlertLevel: value } });
      setDraft(value);
    } catch (e) {
      setError(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  };

  const dirty = draft !== stored;

  return (
    <Card>
      <AppText variant="heading" style={{ marginBottom: 0 }}>
        Safety
      </AppText>
      <ErrorBanner error={error} />

      <NumberField
        label="Pain alert level (optional)"
        value={draft}
        onChange={(value) => {
          setDraft(value);
          setRangeError(null);
        }}
        min={0}
        max={10}
        integer
        error={rangeError}
      />
      <AppText variant="caption" muted>
        {HELPER_TEXT}
      </AppText>

      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Button
            label="Save"
            onPress={() => void save(draft)}
            disabled={!dirty}
            loading={busy}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label="Clear"
            variant="secondary"
            onPress={() => void save(null)}
            disabled={stored === null && draft === null}
            loading={busy}
          />
        </View>
      </View>
    </Card>
  );
}
