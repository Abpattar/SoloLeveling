// CONTRACT: CMP-TRN-003 (A2) — `null` means "run whatever is active"
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { SessionRunScreen } from '@/modules/training';

export default function SessionRunRoute(): React.JSX.Element {
  const { ids } = useLocalSearchParams<{ ids?: string }>();
  const plannedExerciseIds =
    typeof ids === 'string' && ids.length > 0 ? ids.split(',').filter((id) => id.length > 0) : null;
  return <SessionRunScreen plannedExerciseIds={plannedExerciseIds} />;
}
