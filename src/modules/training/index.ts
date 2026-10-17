/**
 * INTEGRATION CONTRACT: module index for `@/modules/training`
 * Purpose: the ONLY public surface of the training module. Other modules import from here; internal
 *          files stay private (FILE_OWNERSHIP_MAP §5).
 * Consumers: src/app/**, src/shell/** (A7); reminders and progress via allowed edges only
 * Contract status: APPROVED
 */

// API-TRN-001 .. API-TRN-007
export {
  createExercise,
  deleteExercise,
  getExercise,
  listExercises,
  listExercisesScheduledFor,
  reorderExercises,
  updateExercise,
} from './data/exerciseRepository';

// API-TRN-008 .. API-TRN-015
export {
  deleteSession,
  getCompletedSessionCountsByDate,
  getSession,
  getSessionDayStatus,
  listSessions,
  listSessionsForDate,
  saveSession,
  updateSessionReflection,
} from './data/sessionRepository';

// CMP-TRN-001 .. CMP-TRN-007
export { ExerciseListScreen } from './screens/ExerciseListScreen';
export { ExerciseEditorScreen } from './screens/ExerciseEditorScreen';
export { SessionRunScreen } from './screens/SessionRunScreen';
export { SessionCompleteScreen } from './screens/SessionCompleteScreen';
export { SessionHistoryScreen } from './screens/SessionHistoryScreen';
export { SessionDetailScreen } from './screens/SessionDetailScreen';
export { TodayExerciseCard } from './components/TodayExerciseCard';