/**
 * INTEGRATION CONTRACT: TYPE-TRN-001 .. TYPE-TRN-011
 * Purpose: exercises (the user's own clinician-approved list) and recorded sessions.
 * Canonical definition: SHARED_CONTRACT.md §3.5
 * Consumers: training (A2), reminders (A2), progress (A6), photos (A5), shared activityCalories (A1)
 * Contract status: APPROVED
 */
import type { Id, IsoDateTime, LocalDate } from './common';
import type { SymptomFlag } from './safety';

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7; // ISO: 1=Mon … 7=Sun
export type ExerciseStatus = 'active' | 'paused';
export type ExerciseIntensity = 'light' | 'moderate' | 'vigorous';

export interface Exercise {
  id: Id;
  name: string;
  instructions: string | null;
  sets: number; // >= 1
  reps: number | null; // at least one of reps / durationSeconds is non-null
  durationSeconds: number | null;
  restSeconds: number; // >= 0
  scheduleDays: Weekday[];
  clinicianNotes: string | null;
  intensity: ExerciseIntensity | null;
  status: ExerciseStatus;
  sortOrder: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface ExerciseInput {
  name: string;
  instructions?: string | null;
  sets: number;
  reps?: number | null;
  durationSeconds?: number | null;
  restSeconds?: number;
  scheduleDays: Weekday[];
  clinicianNotes?: string | null;
  intensity?: ExerciseIntensity | null;
  status?: ExerciseStatus;
}

export type SessionStatus = 'completed' | 'stopped';
export type SessionExerciseStatus = 'completed' | 'partial' | 'skipped';

export interface SessionExerciseResult {
  id: Id;
  sessionId: Id;
  exerciseId: Id | null; // null if the exercise was later deleted
  exerciseName: string; // snapshot
  plannedSets: number;
  plannedReps: number | null;
  plannedDurationSeconds: number | null;
  completedSets: number;
  completedReps: number | null; // total reps across sets, null for duration-only
  activeSeconds: number; // time spent working, excluding rest
  status: SessionExerciseStatus;
  intensity: ExerciseIntensity | null; // snapshot
  sortOrder: number;
}

export interface Session {
  id: Id;
  startedAt: IsoDateTime;
  endedAt: IsoDateTime | null;
  localDate: LocalDate;
  status: SessionStatus;
  totalDurationSeconds: number;
  effortRating: number | null; // 1..10
  notes: string | null;
  painScore: number | null; // 0..10
  symptomFlags: SymptomFlag[];
  estimatedKcal: number | null; // rough workout estimate; never combined with intake
  results: SessionExerciseResult[];
  createdAt: IsoDateTime;
}

export interface SaveSessionInput {
  startedAt: IsoDateTime;
  endedAt: IsoDateTime;
  status: SessionStatus;
  totalDurationSeconds: number;
  results: Array<Omit<SessionExerciseResult, 'id' | 'sessionId'>>;
}

export interface SessionDayStatus {
  localDate: LocalDate;
  scheduledExerciseCount: number; // active exercises scheduled for that weekday
  completedSessionCount: number;
  stoppedSessionCount: number;
}