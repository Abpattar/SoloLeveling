/**
 * INTEGRATION CONTRACT: TYPE-JRN-001 .. TYPE-JRN-003
 * Purpose: optional recovery journal (pain, stiffness, swelling, notes). Tracking only.
 * Canonical definition: SHARED_CONTRACT.md §3.9
 * Consumers: journal (A6), progress (A6)
 * Contract status: APPROVED
 */
import type { Id, IsoDateTime, LocalDate } from './common';
import type { SymptomFlag } from './safety';

export type SwellingLevel = 'none' | 'mild' | 'moderate' | 'significant';

export interface JournalEntry {
  id: Id;
  localDate: LocalDate;
  recordedAt: IsoDateTime;
  painScore: number | null;
  stiffnessScore: number | null;
  swellingLevel: SwellingLevel | null;
  symptomFlags: SymptomFlag[];
  notes: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface JournalEntryInput {
  localDate?: LocalDate;
  painScore?: number | null;
  stiffnessScore?: number | null;
  swellingLevel?: SwellingLevel | null;
  symptomFlags?: SymptomFlag[];
  notes?: string | null;
}