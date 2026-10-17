/**
 * INTEGRATION CONTRACT: TYPE-SAFE-001, TYPE-SAFE-002, TYPE-SAFE-003
 * Purpose: symptom reporting shape and the fixed stop-and-contact advice the app may show.
 * Canonical definition: SHARED_CONTRACT.md §3.4
 * Consumers: shared safety (A1), training (A2), journal (A6)
 * Contract status: APPROVED
 */

export type SymptomFlag =
  | 'sharp_or_increasing_pain'
  | 'new_swelling'
  | 'giving_way'
  | 'locking_or_catching'
  | 'numbness_or_tingling'
  | 'other_new_symptom';

export interface SymptomReport {
  flags: SymptomFlag[];
  painScore: number | null; // painScore 0..10
}

export interface SafetyAdvice {
  level: 'stop_and_contact_clinician';
  title: string;
  message: string;
  reasons: string[]; // human labels of triggering flags / pain level
}