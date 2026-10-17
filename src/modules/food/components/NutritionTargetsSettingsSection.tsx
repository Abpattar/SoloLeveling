/**
 * INTEGRATION CONTRACT: CMP-FOOD-006
 * Purpose: optional user-entered calorie and protein targets. The app never suggests, recommends or
 *          interprets them (REQ-NUT-004, SAF-04).
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CMP-FOOD-006)
 * Consumers: src/shell/SettingsScreen.tsx (A7)
 * Contract status: APPROVED
 */
import React, { useState } from 'react';
// CONTRACT: HOOK-SET-001 (A1) — settings read/write
import { useSettings } from '@/shared/settings/SettingsProvider';
import { Card } from '@/shared/ui/Card';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { NumberField } from '@/shared/ui/fields';
import { useTheme } from '@/shared/ui/theme';
import { toAppError } from '@/shared/errors/AppError';
import type { AppSettings } from '@/shared/types/settings';

export function NutritionTargetsSettingsSection(): React.JSX.Element {
  const theme = useTheme();
  const { settings, update } = useSettings();
  const [calories, setCalories] = useState<number | null>(settings.nutrition.targetCaloriesKcal);
  const [protein, setProtein] = useState<number | null>(settings.nutrition.targetProteinGrams);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      const patch: Partial<AppSettings['nutrition']> = {
        targetCaloriesKcal: calories !== null && calories > 0 ? Math.round(calories) : null,
        targetProteinGrams: protein !== null && protein > 0 ? Math.round(protein) : null,
      };
      await update({ nutrition: patch });
    } catch (e) {
      setError(toAppError(e).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <AppText variant="heading" style={{ marginBottom: 0 }}>
        Daily nutrition targets
      </AppText>
      <AppText variant="caption" muted>
        Optional. Enter targets only if you were given them; this app does not recommend any.
      </AppText>
      <NumberField
        label="Calories"
        value={calories}
        integer
        min={0}
        max={20000}
        unit="kcal"
        onChange={setCalories}
      />
      <NumberField
        label="Protein"
        value={protein}
        integer
        min={0}
        max={1000}
        unit="g"
        onChange={setProtein}
      />
      {error ? (
        <AppText style={{ color: theme.colors.danger }} variant="caption">
          {error}
        </AppText>
      ) : null}
      <Button label="Save targets" onPress={() => void save()} loading={saving} />
    </Card>
  );
}