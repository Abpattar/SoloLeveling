/**
 * INTEGRATION CONTRACT: TYPE-PRG-001
 * Purpose: everything shown for one calendar day, assembled on read (never stored).
 * Canonical definition: SHARED_CONTRACT.md §3.9
 * Consumers: progress (A6), shell (A7)
 * Contract status: APPROVED
 */
import type { LocalDate } from './common';
import type { DailyNutritionTotals } from './food';
import type { Session } from './training';
import type { Measurement } from './body';
import type { JournalEntry } from './journal';

export interface DailySummary {
  localDate: LocalDate;
  nutrition: DailyNutritionTotals;
  targets: { caloriesKcal: number | null; proteinGrams: number | null };
  scheduledExerciseCount: number;
  sessions: Session[];
  estimatedWorkoutKcal: number | null; // sum of completed sessions' estimatedKcal; NEVER combined with intake
  weightKg: number | null; // latest weight measurement on that date, converted to kg
  measurements: Measurement[];
  journalEntries: JournalEntry[];
}