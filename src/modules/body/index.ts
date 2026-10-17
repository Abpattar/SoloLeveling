/**
 * INTEGRATION CONTRACT: module index for `@/modules/body`
 * Purpose: the ONLY public surface of the body module. Imports no other module.
 * Consumers: body screens (A6), progress (A6)
 * Contract status: APPROVED
 */

// API-BODY-001..005
export {
  addMeasurement,
  deleteMeasurement,
  getWeightSeriesKg,
  listMeasurements,
  updateMeasurement,
} from './data/measurementRepository';

// CMP-BODY-001
export { MeasurementsScreen } from './screens/MeasurementsScreen';

// LOCAL-WORKAROUND (A6): the pure trend maths is exported so ProgressScreen can chart it without
// importing an internal file.
export { changeFromBaseline, monthlyAverages, movingAverage, weeklyAverages } from './domain/weightSeries';