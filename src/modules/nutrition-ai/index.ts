/**
 * INTEGRATION CONTRACT: module index for `@/modules/nutrition-ai`
 * Purpose: the ONLY public surface of the nutrition-ai module, and the only module allowed to touch
 *          the network. The shell wires these two functions into the food module's estimator bridge
 *          at bootstrap, so the `food -> nutrition-ai` edge stays a single, auditable line.
 * Consumers: src/shell/** (A7), which passes them to food (A3) through the estimator bridge
 * Contract status: APPROVED
 */

// API-AI-001
export { getAnalysisAvailability } from './availability';

// API-AI-002
export { estimateNutritionFromImage } from './estimateService';

// API-AI-003
export { AI_PROVIDER_CATALOG, getProviderInfo, listAiProviders } from './providers/catalog';

// CMP-AI-001
export { AnalysisSettingsSection } from './AnalysisSettingsSection';