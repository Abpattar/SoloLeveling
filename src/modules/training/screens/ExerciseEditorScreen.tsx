/**
 * INTEGRATION CONTRACT: CMP-TRN-002
 * Purpose: create or edit one exercise. `exerciseId === null` creates; otherwise it loads that row.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CMP-TRN-002)
 * Consumers: src/app/exercise/new.tsx and src/app/exercise/[exerciseId].tsx (A7)
 * Contract status: APPROVED
 */
import React, { useCallback, useState } from 'react';
import { router } from 'expo-router';
// CONTRACT: API-TRN-002/003/004 (A2) — load, create and update
import { createExercise, getExercise, updateExercise } from '@/modules/training';
import { ExerciseForm } from '@/modules/training/components/ExerciseForm';
import { Screen } from '@/shared/ui/Screen';
import { AppText } from '@/shared/ui/AppText';
import { ErrorBanner, LoadingView } from '@/shared/ui/feedback';
import { useFocusLoad } from '@/shared/ui/useFocusLoad';
import { toAppError } from '@/shared/errors/AppError';
import type { Exercise, ExerciseInput } from '@/shared/types/training';

export interface ExerciseEditorScreenProps {
  exerciseId: string | null;
}

export function ExerciseEditorScreen({ exerciseId }: ExerciseEditorScreenProps): React.JSX.Element {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<Exercise | null> => {
    if (exerciseId === null) {
      return null;
    }
    return getExercise(exerciseId);
  }, [exerciseId]);

  const { data, loading, error } = useFocusLoad(load, [exerciseId]);

  const save = async (input: ExerciseInput): Promise<void> => {
    setSaving(true);
    setSaveError(null);
    try {
      if (exerciseId === null) {
        await createExercise(input);
      } else {
        await updateExercise(exerciseId, input);
      }
      router.back();
    } catch (e) {
      setSaveError(toAppError(e).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <AppText variant="title">{exerciseId === null ? 'Add exercise' : 'Edit exercise'}</AppText>
      <ErrorBanner error={error} />

      {loading && exerciseId !== null ? <LoadingView /> : null}

      {exerciseId !== null && data === null && !loading ? (
        <AppText muted>That exercise is no longer in your list.</AppText>
      ) : (
        <ExerciseForm
          exercise={data}
          onSave={(input) => void save(input)}
          onCancel={() => router.back()}
          saving={saving}
          errorMessage={saveError}
        />
      )}
    </Screen>
  );
}