/**
 * INTEGRATION CONTRACT: CMP-FOOD-003
 * Purpose: one saved meal with every honest correction path: edit the description, confirm or edit
 *          the estimate, answer one clarification, scale the portion, mark unknown, or delete.
 *          Nothing here teaches the app anything — corrections only change this entry.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CMP-FOOD-003), REQ-FOOD-004/006/010
 * Consumers: src/app/food/entry/[entryId].tsx (A7)
 * Contract status: APPROVED
 */
import React, { useCallback, useState } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
// CONTRACT: API-FOOD-007/009..014, API-FOOD-015 (A3 self)
import {
  analyzeFoodEntry,
  confirmAiEstimate,
  deleteFoodEntry,
  getFoodEntry,
  listMealCategories,
  markNutritionUnknown,
  saveManualNutrition,
  scaleEntryPortion,
  updateFoodEntryDetails,
} from '@/modules/food';
// CONTRACT: API-FILE-002 (A1) — private photo URI
import { resolvePhotoUri } from '@/shared/files/photoStorage';
// CONTRACT: CONST-TEXT-004 (A1) — the fixed estimate disclaimer
import { ESTIMATE_DISCLAIMER_TEXT } from '@/shared/constants/text';
// CONTRACT: API-UI-001 (A1) — destructive confirmation
import { confirmAction } from '@/shared/ui/confirmAction';
import { Screen } from '@/shared/ui/Screen';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Chip } from '@/shared/ui/Chip';
import { DateField, NumberField, TextField, TimeField } from '@/shared/ui/fields';
import { EmptyState, ErrorBanner, LoadingView } from '@/shared/ui/feedback';
import { useFocusLoad } from '@/shared/ui/useFocusLoad';
import { useTheme } from '@/shared/ui/theme';
import { toAppError } from '@/shared/errors/AppError';
import type { FoodEntry, NutritionValues } from '@/shared/types/food';

export interface FoodEntryScreenProps {
  entryId: string;
}

const SCALE_FACTORS = [0.5, 0.75, 1.25, 1.5, 2] as const;

const STATUS_TEXT: Record<FoodEntry['analysisStatus'], string> = {
  not_requested: 'Analysis is off — enter values manually.',
  pending: 'Waiting to analyze.',
  in_progress: 'Analyzing…',
  failed: 'Analysis did not finish.',
  succeeded: '',
  skipped_by_user: 'You chose not to send this photo for analysis.',
};

export function FoodEntryScreen({ entryId }: FoodEntryScreenProps): React.JSX.Element {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState(false);
  const [draft, setDraft] = useState<NutritionValues | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async (): Promise<FoodEntry> => getFoodEntry(entryId), [entryId]);
  const { data: entry, loading, error, reload } = useFocusLoad(load, [entryId]);
  const { data: categories } = useFocusLoad(listMealCategories, []);

  const run = async (action: () => Promise<unknown>): Promise<void> => {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      reload();
    } catch (e) {
      setActionError(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading && !entry) {
    return (
      <Screen>
        <LoadingView />
      </Screen>
    );
  }

  if (!entry) {
    return (
      <Screen>
        <ErrorBanner error={error} />
        <EmptyState
          title="Meal not found"
          message="It may have been deleted."
          action={{ label: 'Back to food', onPress: () => router.back() }}
        />
      </Screen>
    );
  }

  const category = (categories ?? []).find((c) => c.id === entry.mealCategoryId) ?? null;
  const isEstimate = entry.nutritionSource === 'ai_estimate';
  const isSettled = entry.nutritionSource === 'manual' || entry.nutritionSource === 'confirmed';
  const time = entry.capturedAt.slice(11, 16);

  const startEditing = (): void => {
    setDraft(entry.nutrition);
    setEditingValues(true);
  };

  const saveValues = (): void => {
    if (!draft) {
      return;
    }
    void run(async () => {
      if (isEstimate || isSettled) {
        await confirmAiEstimate(entry.id, draft);
      } else {
        await saveManualNutrition(entry.id, draft);
      }
      setEditingValues(false);
      setDraft(null);
    });
  };

  const remove = async (): Promise<void> => {
    const ok = await confirmAction({
      title: 'Delete this meal?',
      message: 'The photo and its values are removed permanently.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) {
      return;
    }
    await run(async () => {
      await deleteFoodEntry(entry.id);
      router.back();
    });
  };

  return (
    <Screen>
      <AppText variant="title">{category?.name ?? 'Meal'}</AppText>
      <ErrorBanner error={error} />
      <ErrorBanner error={actionError} />

      <Image
        source={{ uri: resolvePhotoUri(entry.imagePath) }}
        style={{ width: '100%', height: 220, borderRadius: theme.radius.md }}
        accessibilityLabel="Photo of this meal"
      />

      <AppText variant="caption" muted>
        {entry.localDate} at {time}
      </AppText>
      <AppText variant="caption" muted>
        {ESTIMATE_DISCLAIMER_TEXT}
      </AppText>

      {STATUS_TEXT[entry.analysisStatus] ? (
        <Card>
          <AppText variant="caption" muted style={{ marginBottom: 0 }}>
            {entry.analysisError ?? STATUS_TEXT[entry.analysisStatus]}
          </AppText>
        </Card>
      ) : null}

      {entry.description ? <AppText>{entry.description}</AppText> : null}
      {entry.portionText ? (
        <AppText variant="caption" muted>
          Portion: {entry.portionText}
        </AppText>
      ) : null}

      {entry.pendingClarification ? (
        <Card>
          <AppText variant="heading" style={{ marginBottom: 0 }}>
            {entry.pendingClarification.question}
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {entry.pendingClarification.options.map((option) => (
              <Chip
                key={option}
                label={option}
                onPress={() =>
                  void run(() =>
                    analyzeFoodEntry(entry.id, {
                      clarification: {
                        question: entry.pendingClarification?.question ?? '',
                        answer: option,
                      },
                      overwrite: true,
                    }),
                  )
                }
              />
            ))}
          </View>
        </Card>
      ) : null}

      <Card>
        <AppText variant="heading" style={{ marginBottom: 0 }}>
          {editingValues && draft ? 'Your values' : 'Values'}
        </AppText>
        {editingValues && draft ? (
          <>
            <NumberField
              label="Calories (kcal)"
              value={draft.caloriesKcal}
              integer
              min={0}
              max={5000}
              onChange={(caloriesKcal) => setDraft({ ...draft, caloriesKcal })}
            />
            <NumberField
              label="Protein (g)"
              value={draft.proteinGrams}
              min={0}
              max={300}
              onChange={(proteinGrams) => setDraft({ ...draft, proteinGrams })}
            />
            <NumberField
              label="Carbs (g)"
              value={draft.carbsGrams}
              min={0}
              max={800}
              onChange={(carbsGrams) => setDraft({ ...draft, carbsGrams })}
            />
            <NumberField
              label="Fat (g)"
              value={draft.fatGrams}
              min={0}
              max={400}
              onChange={(fatGrams) => setDraft({ ...draft, fatGrams })}
            />
            <Button label="Save values" onPress={saveValues} loading={busy} />
            <Button label="Cancel" variant="ghost" onPress={() => setEditingValues(false)} disabled={busy} />
          </>
        ) : (
          <>
            <AppText variant="caption" muted>
              Calories:{' '}
              {entry.nutrition.caloriesKcal === null
                ? 'Unknown'
                : `≈ ${Math.round(entry.nutrition.caloriesKcal)} kcal`}
            </AppText>
            <AppText variant="caption" muted>
              Protein:{' '}
              {entry.nutrition.proteinGrams === null
                ? 'Unknown'
                : `≈ ${entry.nutrition.proteinGrams.toFixed(1)} g`}
            </AppText>
            <AppText variant="caption" muted>
              Carbs:{' '}
              {entry.nutrition.carbsGrams === null
                ? 'Unknown'
                : `≈ ${entry.nutrition.carbsGrams.toFixed(1)} g`}
            </AppText>
            <AppText variant="caption" muted>
              Fat:{' '}
              {entry.nutrition.fatGrams === null
                ? 'Unknown'
                : `≈ ${entry.nutrition.fatGrams.toFixed(1)} g`}
            </AppText>
          </>
        )}
      </Card>

      {isEstimate ? (
        <Button label="Confirm estimate" onPress={() => void run(() => confirmAiEstimate(entry.id))} loading={busy} />
      ) : null}

      {!editingValues ? (
        <Button label="Edit values" variant="secondary" onPress={startEditing} disabled={busy} />
      ) : null}

      <Card>
        <AppText variant="label" muted>
          Portion size
        </AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.xs }}>
          {SCALE_FACTORS.map((factor) => (
            <Button
              key={factor}
              label={`x${factor}`}
              variant="secondary"
              onPress={() => void run(() => scaleEntryPortion(entry.id, factor))}
              disabled={busy}
            />
          ))}
        </ScrollView>
      </Card>

      <Button
        label="Mark nutrition unknown"
        variant="secondary"
        onPress={() => void run(() => markNutritionUnknown(entry.id))}
        disabled={busy}
      />

      {entry.analysisStatus === 'pending' || entry.analysisStatus === 'failed' ? (
        <Button
          label={entry.analysisStatus === 'failed' ? 'Retry analysis' : 'Analyze now'}
          variant="secondary"
          onPress={() => void run(() => analyzeFoodEntry(entry.id, { overwrite: true }))}
          disabled={busy}
        />
      ) : null}

      <Card>
        <TextField
          label="Note"
          value={note ?? entry.note ?? ''}
          onChangeText={(value) => setNote(value)}
          multiline
        />
        <Button
          label="Save note"
          variant="secondary"
          onPress={() =>
            void run(async () => {
              await updateFoodEntryDetails(entry.id, { note: note ?? entry.note });
              setNote(null);
            })
          }
          disabled={busy}
        />
        <DateField
          label="Date"
          value={entry.localDate}
          onChange={(next) =>
            void run(() =>
              updateFoodEntryDetails(entry.id, {
                capturedAt: new Date(`${next}T${time}:00`).toISOString(),
              }),
            )
          }
        />
        <TimeField
          label="Time"
          value={time}
          onChange={(next) =>
            void run(() =>
              updateFoodEntryDetails(entry.id, {
                capturedAt: new Date(`${entry.localDate}T${next}:00`).toISOString(),
              }),
            )
          }
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {(categories ?? []).map((option) => (
            <Chip
              key={option.id}
              label={option.name}
              selected={option.id === entry.mealCategoryId}
              onPress={() =>
                void run(() => updateFoodEntryDetails(entry.id, { mealCategoryId: option.id }))
              }
            />
          ))}
        </View>
      </Card>

      <Button label="Delete meal" variant="danger" onPress={() => void remove()} loading={busy} />
    </Screen>
  );
}