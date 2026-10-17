// CONTRACT: CMP-TRN-002 (A2)
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ExerciseEditorScreen } from '@/modules/training';

export default function EditExerciseRoute(): React.JSX.Element {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  return <ExerciseEditorScreen exerciseId={exerciseId} />;
}
