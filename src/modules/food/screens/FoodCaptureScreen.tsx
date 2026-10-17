/**
 * INTEGRATION CONTRACT: CMP-FOOD-002
 * Purpose: camera-first meal capture. Photo first, then the details. Analysis is only ever offered
 *          when the estimator reports itself ready, so a user who has not opted in is never shown a
 *          choice that would send their photo anywhere.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CMP-FOOD-002), REQ-FOOD-001/012
 * Consumers: src/app/food/capture.tsx (A7)
 * Contract status: APPROVED
 */
import React, { useCallback, useState } from 'react';
import { Image, View } from 'react-native';
import { router } from 'expo-router';
// CONTRACT: API-FOOD-006/001 (A3 self)
import { createFoodEntryFromPhoto, listMealCategories } from '@/modules/food';
// CONTRACT: CMP-UI-015 (A1) — the only camera surface
import { PhotoCapture } from '@/shared/ui/PhotoCapture';
// CONTRACT: CONST-NAV-001 (A1) — route builder
import { ROUTES } from '@/shared/navigation/routes';
import { getAnalysisAvailabilitySafe } from '@/modules/food/services/estimatorBridge';
import { Screen } from '@/shared/ui/Screen';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { DateField, TextField, TimeField } from '@/shared/ui/fields';
import { ErrorBanner, LoadingView } from '@/shared/ui/feedback';
import { useFocusLoad } from '@/shared/ui/useFocusLoad';
import { useTheme } from '@/shared/ui/theme';
import { toAppError } from '@/shared/errors/AppError';
import { toLocalDate } from '@/shared/utils/dates';
import type { MealCategory } from '@/shared/types/food';

export interface FoodCaptureScreenProps {
  mealCategoryId: string | null;
}

/** LOCAL-WORKAROUND (internal): the meal that best matches the clock, per AGENT_03 §3. */
function defaultCategoryId(hour: number): string {
  if (hour < 11) {
    return 'meal-breakfast';
  }
  if (hour < 15) {
    return 'meal-lunch';
  }
  if (hour < 18) {
    return 'meal-snacks';
  }
  return 'meal-dinner';
}

function currentTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function FoodCaptureScreen({ mealCategoryId }: FoodCaptureScreenProps): React.JSX.Element {
  const theme = useTheme();
  const [tempUri, setTempUri] = useState<string | null>(null);
  const [overrideCategoryId, setOverrideCategoryId] = useState<string | null>(null);
  const [date, setDate] = useState<string>(toLocalDate(new Date()));
  const [time, setTime] = useState<string>(currentTime());
  const [note, setNote] = useState('');
  const [optOut, setOptOut] = useState(false);
  const [analysisReady, setAnalysisReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<MealCategory[]> => listMealCategories(), []);
  const { data: categories, loading } = useFocusLoad(load, []);

  // Derived, not stored: the meal that best matches the clock is used until the user picks one.
  const preferredCategoryId =
    mealCategoryId ??
    (categories && categories.length > 0
      ? (categories.find((c) => c.id === defaultCategoryId(new Date().getHours())) ??
        categories[0])?.id ?? null
      : null);
  const selectedCategoryId = overrideCategoryId ?? preferredCategoryId;

  React.useEffect(() => {
    let cancelled = false;
    void getAnalysisAvailabilitySafe().then((availability) => {
      if (!cancelled) {
        setAnalysisReady(availability.state === 'ready');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (tempUri === null) {
    return (
      <PhotoCapture
        title="Take a photo of your meal"
        onCaptured={(uri) => setTempUri(uri)}
        onCancel={() => router.back()}
      />
    );
  }

  const save = async (): Promise<void> => {
    if (selectedCategoryId === null) {
      setError('Choose a meal.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const entry = await createFoodEntryFromPhoto({
        mealCategoryId: selectedCategoryId,
        tempImageUri: tempUri,
        capturedAt: new Date(`${date}T${time}:00`).toISOString(),
        note: note.trim().length > 0 ? note.trim() : null,
        analysisOptOut: optOut,
      });
      router.replace(ROUTES.foodEntry(entry.id));
    } catch (e) {
      // The form stays exactly as the user left it, including the captured photo.
      setError(toAppError(e).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <AppText variant="title">Log this meal</AppText>
      <ErrorBanner error={error} />

      <Image
        source={{ uri: tempUri }}
        style={{ width: '100%', height: 220, borderRadius: theme.radius.md }}
        accessibilityLabel="Photo you just took"
      />

      <AppText variant="heading" muted>
        Meal
      </AppText>
      {loading ? <LoadingView /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {(categories ?? []).map((category) => (
          <Chip
            key={category.id}
            label={category.name}
            selected={category.id === selectedCategoryId}
            onPress={() => setOverrideCategoryId(category.id)}
          />
        ))}
      </View>

      <DateField label="Date" value={date} onChange={(next) => setDate(next)} maxDate={toLocalDate(new Date())} />
      <TimeField label="Time" value={time} onChange={(next) => setTime(next)} />
      <TextField label="Note (optional)" value={note} onChangeText={setNote} multiline />

      {analysisReady ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Chip
            label="Don't send this photo"
            selected={optOut}
            onPress={() => setOptOut((current) => !current)}
          />
          <AppText variant="caption" muted style={{ flex: 1 }}>
            Leave this off to let the analysis service estimate it.
          </AppText>
        </View>
      ) : (
        <AppText variant="caption" muted>
          Photo analysis is off. The photo stays on this phone and you can add values by hand after
          saving.
        </AppText>
      )}

      <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
        <Button label="Save meal" onPress={() => void save()} loading={saving} />
        <Button label="Retake photo" variant="secondary" onPress={() => setTempUri(null)} disabled={saving} />
      </View>
    </Screen>
  );
}