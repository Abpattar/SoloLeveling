/**
 * INTEGRATION CONTRACT: API-ACT-003
 * Purpose: one source of truth for "the user's current weight in kg", so training does not need to
 *          import the body module. Latest weight measurement wins; otherwise the profile baseline.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (API-ACT-003)
 * Consumers: training (A2) via estimateSessionKcal
 * Contract status: APPROVED
 */
import { getDb } from '../db/database';
import { toKg } from '../utils/units';
import { getProfile } from './profileRepository';

interface WeightRow {
  value: number;
  unit: string;
}

/** API-ACT-003 */
export async function getReferenceWeightKg(): Promise<number | null> {
  try {
    const db = await getDb();
    const row = await db.queryOne<WeightRow>(
      `SELECT value, unit FROM measurements
        WHERE type = 'weight'
        ORDER BY measured_at DESC, created_at DESC
        LIMIT 1`,
    );
    if (row) {
      const kg = toKg(Number(row.value), String(row.unit));
      if (kg !== null && Number.isFinite(kg) && kg > 0) {
        return kg;
      }
    }
  } catch {
    // A missing/corrupt measurements table must not break a workout; fall back to the profile.
  }
  const profile = await getProfile();
  return profile.baselineWeightKg;
}