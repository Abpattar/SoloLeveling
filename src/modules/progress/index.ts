/**
 * INTEGRATION CONTRACT: module index for `@/modules/progress`
 * Purpose: the ONLY public surface of the progress module.
 * Consumers: progress routes (A7), measurement and journal screens (A6)
 * Contract status: APPROVED
 */

// REQ-PRG-001/002
export { getDailySummary, getProgressInputs } from './services/dailySummary';

// REQ-PRG-003..006
export { exerciseConsistencyByWeek, weeklyNutritionAverages } from './domain/trends';

// CMP-PRG-001
export { ProgressScreen } from './screens/ProgressScreen';

// LOCAL-WORKAROUND (A6): the SVG charts are dependency-free presentational components shared by
// progress and ody, so they live at @/shared/ui/charts/* (see the note in LineChart.tsx).
// They are NOT re-exported here, which would recreate a ody -> progress edge.