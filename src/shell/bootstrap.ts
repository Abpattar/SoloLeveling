/**
 * INTEGRATION CONTRACT: API-SHELL-001
 * Purpose: the single one-time startup sequence. Opens the database (running migrations), wires the
 *          nutrition-ai estimator into the food bridge, builds the reminder plan, and installs the
 *          foreground listener that retries photo analyses.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (API-SHELL-001), SHARED_CONTRACT.md 5, 7
 * Consumers: src/shell/AppProviders.tsx
 * Contract status: APPROVED
 */
import { AppState } from 'react-native';
// CONTRACT: API-DB-001 (A1) - opens SQLite and runs migrations
import { getDb } from '@/shared/db/database';
// API-CORE-007 (A1) - the only logger; failures here must be visible but never fatal
import { logger } from '@/shared/utils/logger';
// CONTRACT: API-FOOD-015 (A3) - the single seam to nutrition-ai, wired here and nowhere else
import { processPendingAnalyses, setEstimatorBridge } from '@/modules/food';
// CONTRACT: API-AI-001/002 (A4) - the two functions behind the bridge
import { estimateNutritionFromImage, getAnalysisAvailability } from '@/modules/nutrition-ai';
// CONTRACT: API-REM-001 (A2) - builds the reminder plan and subscribes to app events
import { initializeReminders } from '@/modules/reminders';

let started: Promise<void> | null = null;
let foregroundListenerAttached = false;

/**
 * Retries photo analyses that were queued while offline. Never throws: a failed retry leaves the
 * entry in `pending` and the next foreground tick tries again.
 */
async function runPendingAnalyses(): Promise<void> {
  try {
    const result = await processPendingAnalyses();
    if (result.processed > 0 || result.failed > 0) {
      logger.info('Queued photo analyses processed.', result);
    }
  } catch (e) {
    logger.warn('Queued photo analyses could not be processed.', { error: String(e) });
  }
}

/**
 * The food module calls these through its bridge. Wiring them here keeps the legal
 * `food -> nutrition-ai` edge in one auditable line.
 */
function wireEstimatorBridge(): void {
  setEstimatorBridge({ getAnalysisAvailability, estimateNutritionFromImage });
}

function attachForegroundListener(): void {
  if (foregroundListenerAttached) {
    return;
  }
  foregroundListenerAttached = true;
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void runPendingAnalyses();
    }
  });
}

async function start(): Promise<void> {
  await getDb();

  wireEstimatorBridge();

  try {
    await initializeReminders();
  } catch (e) {
    logger.warn('Reminders could not be set up.', { error: String(e) });
  }

  attachForegroundListener();
  await runPendingAnalyses();
}

/**
 * Only the database is allowed to reject, and a rejected attempt is not remembered: the user gets a
 * retry button and the next call really does re-run the sequence. Reminders and photo analysis are
 * conveniences, so if either fails the app still launches and the failure is logged, not thrown.
 */
export async function bootstrapApp(): Promise<void> {
  if (started === null) {
    // A rejected promise is cleared so a retry can run the sequence from the top again.
    started = start().catch((e: unknown) => {
      started = null;
      throw e;
    });
  }
  return started;
}

/** LOCAL-WORKAROUND (A7): tests need to run `bootstrapApp()` more than once in one process. */
export function resetBootstrapForTesting(): void {
  started = null;
  foregroundListenerAttached = false;
}
