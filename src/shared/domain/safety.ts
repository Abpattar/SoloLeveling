/**
 * INTEGRATION CONTRACT: API-SAFE-001
 * Purpose: the ONLY place the app decides to show stop-and-contact advice. The app never invents a
 *          clinical threshold: advice appears only for a ticked symptom flag or a pain score at or
 *          above the number the user themselves set. It never changes the exercise plan.
 * Canonical definition: ERROR_HANDLING_AND_SECURITY.md SAF-03, CONTRACT §6
 * Consumers: training (A2), journal (A6)
 * Contract status: APPROVED
 */
import { SAFETY_ADVICE_MESSAGE, SAFETY_ADVICE_TITLE, SYMPTOM_FLAG_LABELS } from '../constants/text';
import type { SafetyAdvice, SymptomReport } from '../types/safety';

/** API-SAFE-001 */
export function evaluateSymptomReport(
  report: SymptomReport,
  painAlertLevel: number | null,
): SafetyAdvice | null {
  const flags = Array.isArray(report.flags) ? report.flags : [];
  const painScore = report.painScore;
  const painTriggers =
    painAlertLevel !== null && painScore !== null && painScore >= painAlertLevel;

  if (flags.length === 0 && !painTriggers) {
    return null;
  }

  const reasons: string[] = [];
  for (const flag of flags) {
    const label = SYMPTOM_FLAG_LABELS[flag];
    if (label) {
      reasons.push(label);
    }
  }
  if (painTriggers && painScore !== null) {
    reasons.push(`Pain ${painScore}/10 (your alert level: ${painAlertLevel})`);
  }

  return {
    level: 'stop_and_contact_clinician',
    title: SAFETY_ADVICE_TITLE,
    message: SAFETY_ADVICE_MESSAGE,
    reasons,
  };
}