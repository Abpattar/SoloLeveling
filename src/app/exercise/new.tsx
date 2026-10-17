// CONTRACT: CMP-TRN-002 (A2) — `null` means "create", not "edit"
import React from 'react';
import { ExerciseEditorScreen } from '@/modules/training';

export default function NewExerciseRoute(): React.JSX.Element {
  return <ExerciseEditorScreen exerciseId={null} />;
}
