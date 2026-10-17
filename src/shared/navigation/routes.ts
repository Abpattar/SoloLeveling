/**
 * INTEGRATION CONTRACT: CONST-NAV-001
 * Purpose: every route string in the app. Route files are thin wrappers, so this is the single
 *          place where URL shape (including query strings) is decided.
 * Canonical definition: SHARED_CONTRACT.md §4
 * Consumers: every screen, shell (A7), reminders (A2) notification payloads
 * Contract status: APPROVED
 */

export const ROUTES = {
  onboarding: '/onboarding',
  today: '/',
  exercises: '/exercises',
  food: '/food',
  photos: '/photos',
  progress: '/progress',
  settings: '/settings',
  exerciseNew: '/exercise/new',
  exerciseEdit: (exerciseId: string): string => `/exercise/${encodeURIComponent(exerciseId)}`,
  sessionRun: (plannedExerciseIds?: string[]): string =>
    plannedExerciseIds && plannedExerciseIds.length > 0
      ? `/session/run?ids=${plannedExerciseIds.map(encodeURIComponent).join(',')}`
      : '/session/run',
  sessionComplete: (sessionId: string): string =>
    `/session/complete/${encodeURIComponent(sessionId)}`,
  sessionHistory: '/session/history',
  sessionDetail: (sessionId: string): string => `/session/${encodeURIComponent(sessionId)}`,
  foodCapture: (mealCategoryId?: string): string =>
    mealCategoryId ? `/food/capture?mealCategoryId=${encodeURIComponent(mealCategoryId)}` : '/food/capture',
  foodEntry: (entryId: string): string => `/food/entry/${encodeURIComponent(entryId)}`,
  mealCategories: '/food/categories',
  photoCapture: (sessionId?: string): string =>
    sessionId ? `/photos/capture?sessionId=${encodeURIComponent(sessionId)}` : '/photos/capture',
  photoCompare: (journeyId: string, milestoneDay: number): string =>
    `/photos/compare/${encodeURIComponent(journeyId)}/${encodeURIComponent(String(milestoneDay))}`,
  photoTimeline: (journeyId: string): string =>
    `/photos/timeline/${encodeURIComponent(journeyId)}`,
  journeys: '/photos/journeys',
  measurements: '/measurements',
  journal: '/journal',
  journalEntry: (entryIdOrNew: string): string =>
    `/journal/${encodeURIComponent(entryIdOrNew)}`,
  dailySummary: (date: string): string => `/summary/${encodeURIComponent(date)}`,
  backup: '/backup',
} as const;

export type Routes = typeof ROUTES;