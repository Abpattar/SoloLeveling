/** @jest-environment node */
import { validateExerciseInput, validateExercisePatch } from '../domain/validation';
import type { NormalizedExerciseInput } from '../domain/validation';
import type { ExerciseInput, Weekday } from '@/shared/types/training';

const base: ExerciseInput = {
  name: 'Straight leg raise',
  sets: 3,
  reps: 10,
  restSeconds: 60,
  scheduleDays: [1, 2] as Weekday[],
};

describe('name', () => {
  it('requires a non-empty trimmed name', () => {
    expect(validateExerciseInput(base).name).toBe('Straight leg raise');
    expect(validateExerciseInput({ ...base, name: '  Knee bends  ' }).name).toBe('Knee bends');
    expect(() => validateExerciseInput({ ...base, name: '' })).toThrow();
    expect(() => validateExerciseInput({ ...base, name: '    ' })).toThrow();
  });

  it('caps the name at 80 characters', () => {
    expect(validateExerciseInput({ ...base, name: 'x'.repeat(80) }).name).toHaveLength(80);
    expect(() => validateExerciseInput({ ...base, name: 'x'.repeat(81) })).toThrow();
  });
});

describe('sets, reps and duration', () => {
  it('accepts sets 1..50 only', () => {
    expect(validateExerciseInput({ ...base, sets: 1 }).sets).toBe(1);
    expect(validateExerciseInput({ ...base, sets: 50 }).sets).toBe(50);
    expect(() => validateExerciseInput({ ...base, sets: 0 })).toThrow();
    expect(() => validateExerciseInput({ ...base, sets: 51 })).toThrow();
    expect(() => validateExerciseInput({ ...base, sets: 2.5 })).toThrow();
    expect(() => validateExerciseInput({ ...base, sets: Number.NaN })).toThrow();
  });

  it('accepts reps 1..1000 or null', () => {
    expect(validateExerciseInput({ ...base, reps: 1 }).reps).toBe(1);
    expect(validateExerciseInput({ ...base, reps: 1000 }).reps).toBe(1000);
    expect(() => validateExerciseInput({ ...base, reps: 0 })).toThrow();
    expect(() => validateExerciseInput({ ...base, reps: 1001 })).toThrow();
    expect(() => validateExerciseInput({ ...base, reps: 10.5 })).toThrow();
  });

  it('accepts duration 1..7200 seconds or null', () => {
    expect(validateExerciseInput({ ...base, durationSeconds: 1 }).durationSeconds).toBe(1);
    expect(validateExerciseInput({ ...base, durationSeconds: 7200 }).durationSeconds).toBe(7200);
    expect(() => validateExerciseInput({ ...base, durationSeconds: 0 })).toThrow();
    expect(() => validateExerciseInput({ ...base, durationSeconds: 7201 })).toThrow();
  });

  it('requires at least one of reps or duration', () => {
    expect(() => validateExerciseInput({ ...base, reps: null })).toThrow();
    expect(() => validateExerciseInput({ ...base, reps: null, durationSeconds: null })).toThrow();
    const both = validateExerciseInput({ ...base, reps: 10, durationSeconds: 60 });
    expect(both.reps).toBe(10);
    expect(both.durationSeconds).toBe(60);
  });
});

describe('rest', () => {
it('defaults to 0 when restSeconds is omitted', () => {
const { restSeconds: _omitted, ...withoutRest } = base;
expect(validateExerciseInput(withoutRest).restSeconds).toBe(0);
expect(validateExerciseInput({ ...base, restSeconds: 900 }).restSeconds).toBe(900);
expect(() => validateExerciseInput({ ...base, restSeconds: -1 })).toThrow();
expect(() => validateExerciseInput({ ...base, restSeconds: 901 })).toThrow();
});
});

describe('schedule days', () => {
  it('requires at least one day', () => {
    expect(() => validateExerciseInput({ ...base, scheduleDays: [] })).toThrow();
  });

  it('rejects values outside 1..7', () => {
    expect(() => validateExerciseInput({ ...base, scheduleDays: [0 as Weekday] })).toThrow();
    expect(() => validateExerciseInput({ ...base, scheduleDays: [8 as Weekday] })).toThrow();
    expect(() => validateExerciseInput({ ...base, scheduleDays: ['1' as never] })).toThrow();
  });

  it('deduplicates and sorts', () => {
    expect(validateExerciseInput({ ...base, scheduleDays: [5, 1, 5] as Weekday[] }).scheduleDays).toEqual([
      1, 5,
    ]);
  });
});

describe('optional text', () => {
  it('turns blank text into null and caps length at 2000', () => {
    const value = validateExerciseInput({ ...base, instructions: '  ', clinicianNotes: null });
    expect(value.instructions).toBeNull();
    expect(value.clinicianNotes).toBeNull();
    expect(() => validateExerciseInput({ ...base, instructions: 'x'.repeat(2001) })).toThrow();
    expect(() => validateExerciseInput({ ...base, clinicianNotes: 'x'.repeat(2001) })).toThrow();
  });
});

describe('intensity and status', () => {
  it('accepts only the three planned intensities', () => {
    expect(validateExerciseInput({ ...base, intensity: null }).intensity).toBeNull();
    expect(validateExerciseInput({ ...base, intensity: 'light' }).intensity).toBe('light');
    expect(validateExerciseInput({ ...base, intensity: 'vigorous' }).intensity).toBe('vigorous');
    expect(() => validateExerciseInput({ ...base, intensity: 'max' as never })).toThrow();
  });

  it('defaults the status to active', () => {
    expect(validateExerciseInput(base).status).toBe('active');
    expect(validateExerciseInput({ ...base, status: 'paused' }).status).toBe('paused');
    expect(() => validateExerciseInput({ ...base, status: 'archived' as never })).toThrow();
  });
});

describe('validateExercisePatch', () => {
  const current: NormalizedExerciseInput = validateExerciseInput(base);

  it('validates the merged result, not just the patch', () => {
    expect(validateExercisePatch({ sets: 4 }, current).sets).toBe(4);
    expect(validateExercisePatch({ sets: 4 }, current).reps).toBe(10);
    // Clearing reps while duration is also null must fail even though the patch itself looked fine.
    expect(() => validateExercisePatch({ reps: null }, current)).toThrow();
  });

it('treats an empty patch as a no-op and rejects a non-object patch', () => {
expect(validateExercisePatch({}, current)).toEqual(current);
expect(() => validateExercisePatch(null as never, current)).toThrow();
});
});