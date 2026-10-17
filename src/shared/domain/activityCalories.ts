/**
 * INTEGRATION CONTRACT: API-ACT-001, API-ACT-002
 * Purpose: rough workout-calorie estimates. These are NEVER added to or subtracted from food intake
 *          and never presented as a total energy expenditure. Null unless intensity, weight and a
 *          positive active duration are all known.
 * Canonical definition: MASTER_REQUIREMENTS REQ-ACT-002/005, ERROR_HANDLING_AND_SECURITY SAF-06
 * Consumers: training (A2) — `saveSession` stores the result; A6 and A7 only display it
 * Contract status: APPROVED
 */
import { INTENSITY_MET } from '../constants/text';
import type { ExerciseIntensity, SessionExerciseResult } from '../types/training';

/** API-ACT-001 — round(MET x kg x activeSeconds/3600). */
export function estimateExerciseKcal(p: {
  intensity: ExerciseIntensity | null;
  weightKg: number | null;
  activeSeconds: number;
}): number | null {
  const { intensity, weightKg, activeSeconds } = p;
  if (!intensity) {
    return null;
  }
  if (weightKg === null || !Number.isFinite(weightKg) || weightKg <= 0) {
    return null;
  }
  if (!Number.isFinite(activeSeconds) || activeSeconds <= 0) {
    return null;
  }
  const met = INTENSITY_MET[intensity];
  if (!Number.isFinite(met)) {
    return null;
  }
  return Math.round((met * weightKg * activeSeconds) / 3600);
}

/** API-ACT-002 — sum of the exercises that had enough information; null if none did. */
export function estimateSessionKcal(
  results: Array<Pick<SessionExerciseResult, 'intensity' | 'activeSeconds'>>,
  weightKg: number | null,
): number | null {
  let total = 0;
  let any = false;
  for (const result of results) {
    const value = estimateExerciseKcal({
      intensity: result.intensity,
      weightKg,
      activeSeconds: result.activeSeconds,
    });
    if (value !== null) {
      total += value;
      any = true;
    }
  }
  return any ? total : null;
}