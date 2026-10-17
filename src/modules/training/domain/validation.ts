/**
 * INTEGRATION CONTRACT: internal (A2 training)
 * Purpose: the single validation surface for exercise input. The app never invents or adjusts a
 *          prescription; it only refuses values that could not have been meant.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (API-TRN-003/004 VALIDATION clauses)
 * Consumers: exerciseRepository.ts
 * Contract status: APPROVED (internal symbol, no registry ID)
 */
import { AppError } from '@/shared/errors/AppError';
import type { ExerciseInput, ExerciseIntensity, Weekday } from '@/shared/types/training';

const INTENSITIES: ExerciseIntensity[] = ['light', 'moderate', 'vigorous'];
const STATUSES = ['active', 'paused'] as const;

function requireTrimmedString(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string') {
    throw new AppError('VALIDATION', `${label} is required.`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new AppError('VALIDATION', `${label} is required.`);
  }
  if (trimmed.length > max) {
    throw new AppError('VALIDATION', `${label} must be ${max} characters or fewer.`);
  }
  return trimmed;
}

function optionalText(value: unknown, label: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new AppError('VALIDATION', `${label} must be text.`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > 2000) {
    throw new AppError('VALIDATION', `${label} must be 2000 characters or fewer.`);
  }
  return trimmed;
}

function requireInt(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw new AppError('VALIDATION', `${label} must be a whole number.`);
  }
  if (value < min || value > max) {
    throw new AppError('VALIDATION', `${label} must be between ${min} and ${max}.`);
  }
  return value;
}

function optionalInt(value: unknown, label: string, min: number, max: number): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  return requireInt(value, label, min, max);
}

function requireScheduleDays(value: unknown): Weekday[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AppError('VALIDATION', 'Choose at least one day for this exercise.');
  }
  const seen = new Set<number>();
  for (const day of value) {
    if (typeof day !== 'number' || !Number.isInteger(day) || day < 1 || day > 7) {
      throw new AppError('VALIDATION', 'Choose at least one day for this exercise.');
    }
    seen.add(day);
  }
  return Array.from(seen).sort((a, b) => a - b) as Weekday[];
}

export interface NormalizedExerciseInput {
  name: string;
  instructions: string | null;
  sets: number;
  reps: number | null;
  durationSeconds: number | null;
  restSeconds: number;
  scheduleDays: Weekday[];
  clinicianNotes: string | null;
  intensity: ExerciseIntensity | null;
  status: (typeof STATUSES)[number];
}

/** Throws `VALIDATION`. Returns the normalized values so the repository writes clean rows. */
export function validateExerciseInput(input: ExerciseInput): NormalizedExerciseInput {
  if (input === null || typeof input !== 'object') {
    throw new AppError('VALIDATION', 'Enter the exercise details.');
  }
  const name = requireTrimmedString(input.name, 'Exercise name', 80);
  const sets = requireInt(input.sets, 'Sets', 1, 50);
  const reps = optionalInt(input.reps, 'Repetitions', 1, 1000);
  const durationSeconds = optionalInt(input.durationSeconds, 'Duration', 1, 7200);
  if (reps === null && durationSeconds === null) {
    throw new AppError(
      'VALIDATION',
      'Enter repetitions or a duration for this exercise.',
    );
  }
  const restSeconds = input.restSeconds === undefined ? 0 : requireInt(input.restSeconds, 'Rest', 0, 900);
  const scheduleDays = requireScheduleDays(input.scheduleDays);
  const instructions = optionalText(input.instructions, 'Instructions');
  const clinicianNotes = optionalText(input.clinicianNotes, 'Clinician notes');
  const intensity =
    input.intensity === undefined || input.intensity === null
      ? null
      : (() => {
          if (!INTENSITIES.includes(input.intensity as ExerciseIntensity)) {
            throw new AppError('VALIDATION', 'Choose light, moderate or vigorous.');
          }
          return input.intensity as ExerciseIntensity;
        })();
  const status =
    input.status === undefined
      ? 'active'
      : (() => {
          if (!STATUSES.includes(input.status)) {
            throw new AppError('VALIDATION', 'That status is not valid.');
          }
          return input.status;
        })();

  return { name, instructions, sets, reps, durationSeconds, restSeconds, scheduleDays, clinicianNotes, intensity, status };
}

/**
 * Throws `VALIDATION` for a patch on its own, then validates the merged result so a patch can never
 * leave an exercise in a state that `createExercise` would have rejected.
 */
export function validateExercisePatch(
  patch: Partial<ExerciseInput>,
  current: NormalizedExerciseInput,
): NormalizedExerciseInput {
  if (patch === null || typeof patch !== 'object') {
    throw new AppError('VALIDATION', 'Enter the exercise details.');
  }
  return validateExerciseInput({ ...current, ...patch });
}