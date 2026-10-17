/** @jest-environment node */
import { createTestDb } from '@/shared/db/testing/createTestDb';
import { getDb, setDbForTesting } from '@/shared/db/database';
import { appEvents } from '@/shared/events/appEvents';
import {
  createExercise,
  deleteExercise,
  getExercise,
  listExercises,
  listExercisesScheduledFor,
  reorderExercises,
  updateExercise,
} from '../data/exerciseRepository';
import { saveSession } from '../data/sessionRepository';
import type { ExerciseInput, Weekday } from '@/shared/types/training';

const base: ExerciseInput = {
  name: 'Straight leg raise',
  instructions: 'Lie down and lift the leg',
  sets: 3,
  reps: 10,
  restSeconds: 60,
  scheduleDays: [1, 3, 5] as Weekday[],
  clinicianNotes: 'Stop if sharp pain',
  intensity: 'light',
};

beforeEach(async () => {
  setDbForTesting(await createTestDb());
});

afterEach(() => {
  setDbForTesting(null);
});

describe('createExercise (API-TRN-003)', () => {
  it('stores a full exercise and appends sortOrder', async () => {
    const first = await createExercise(base);
    const second = await createExercise({ ...base, name: 'Quad set' });
    expect(first.name).toBe('Straight leg raise');
    expect(first.scheduleDays).toEqual([1, 3, 5]);
    expect(first.intensity).toBe('light');
    expect(first.status).toBe('active');
    expect(second.sortOrder).toBe(first.sortOrder + 1);
  });

  it('trims the name and stores empty optional text as null', async () => {
    const created = await createExercise({ ...base, name: '  Heel slides  ', instructions: '   ' });
    expect(created.name).toBe('Heel slides');
    expect(created.instructions).toBeNull();
  });

  it('accepts a duration-only exercise', async () => {
    const created = await createExercise({ ...base, reps: null, durationSeconds: 45 });
    expect(created.reps).toBeNull();
    expect(created.durationSeconds).toBe(45);
  });

  it('rejects the invalid inputs', async () => {
    await expect(createExercise({ ...base, name: '' })).rejects.toThrow();
    await expect(createExercise({ ...base, name: 'x'.repeat(81) })).rejects.toThrow();
    await expect(createExercise({ ...base, sets: 0 })).rejects.toThrow();
    await expect(createExercise({ ...base, sets: 1.5 })).rejects.toThrow();
    await expect(createExercise({ ...base, sets: 51 })).rejects.toThrow();
    await expect(createExercise({ ...base, reps: null, durationSeconds: null })).rejects.toThrow();
    await expect(createExercise({ ...base, restSeconds: -1 })).rejects.toThrow();
    await expect(createExercise({ ...base, restSeconds: 901 })).rejects.toThrow();
    await expect(createExercise({ ...base, scheduleDays: [] })).rejects.toThrow();
    await expect(createExercise({ ...base, scheduleDays: [0 as Weekday] })).rejects.toThrow();
    await expect(createExercise({ ...base, scheduleDays: [8 as Weekday] })).rejects.toThrow();
    await expect(createExercise({ ...base, intensity: 'hard' as never })).rejects.toThrow();
    await expect(createExercise({ ...base, instructions: 'x'.repeat(2001) })).rejects.toThrow();
  });

  it('deduplicates and sorts schedule days', async () => {
    const created = await createExercise({ ...base, scheduleDays: [5, 1, 5] as Weekday[] });
    expect(created.scheduleDays).toEqual([1, 5]);
  });
});

describe('updateExercise (API-TRN-004)', () => {
  it('applies a partial patch and keeps untouched fields', async () => {
    const created = await createExercise(base);
    const updated = await updateExercise(created.id, { sets: 4 });
    expect(updated.sets).toBe(4);
    expect(updated.reps).toBe(10);
    expect(updated.scheduleDays).toEqual([1, 3, 5]);
  });

  it('pauses and resumes', async () => {
    const created = await createExercise(base);
    expect((await updateExercise(created.id, { status: 'paused' })).status).toBe('paused');
    expect((await updateExercise(created.id, { status: 'active' })).status).toBe('active');
  });

  it('rejects an invalid patch and leaves the row untouched (GAT-005)', async () => {
    const created = await createExercise(base);
    await expect(updateExercise(created.id, { sets: 0 })).rejects.toThrow();
    await expect(updateExercise(created.id, { reps: null, durationSeconds: null })).rejects.toThrow();
    const unchanged = await getExercise(created.id);
    expect(unchanged.sets).toBe(3);
    expect(unchanged.reps).toBe(10);
  });

  it('throws NOT_FOUND for an unknown id', async () => {
    await expect(updateExercise('missing', { sets: 2 })).rejects.toThrow();
    await expect(getExercise('missing')).rejects.toThrow();
  });
});

describe('listExercises (API-TRN-001)', () => {
  it('hides paused exercises by default and shows them on request', async () => {
    const a = await createExercise(base);
    await createExercise({ ...base, name: 'Quad set' });
    await updateExercise(a.id, { status: 'paused' });

    expect((await listExercises()).map((e) => e.name)).toEqual(['Quad set']);
    expect((await listExercises({ includePaused: true })).map((e) => e.name).sort()).toEqual([
      'Quad set',
      'Straight leg raise',
    ]);
  });

  it('returns them ordered by sortOrder', async () => {
    await createExercise(base);
    await createExercise({ ...base, name: 'Second' });
    await createExercise({ ...base, name: 'Third' });
    expect((await listExercises()).map((e) => e.name)).toEqual([
      'Straight leg raise',
      'Second',
      'Third',
    ]);
  });
});

describe('listExercisesScheduledFor (API-TRN-007)', () => {
  it('matches only the ISO weekday of the given date', async () => {
    await createExercise({ ...base, name: 'Mon only', scheduleDays: [1] as Weekday[] });
    await createExercise({ ...base, name: 'Tue only', scheduleDays: [2] as Weekday[] });
    expect((await listExercisesScheduledFor('2026-10-12')).map((e) => e.name)).toEqual(['Mon only']);
    expect((await listExercisesScheduledFor('2026-10-13')).map((e) => e.name)).toEqual(['Tue only']);
    expect((await listExercisesScheduledFor('2026-10-14')).map((e) => e.name)).toEqual([]);
  });

  it('ignores paused exercises', async () => {
    const paused = await createExercise({ ...base, scheduleDays: [1] as Weekday[] });
    await updateExercise(paused.id, { status: 'paused' });
    expect(await listExercisesScheduledFor('2026-10-12')).toEqual([]);
  });

  it('rejects an invalid date', async () => {
    await expect(listExercisesScheduledFor('2026-02-30')).rejects.toThrow();
  });
});

describe('reorderExercises (API-TRN-006)', () => {
  it('rewrites sort_order 0..n-1 in one transaction', async () => {
    const a = await createExercise(base);
    const b = await createExercise({ ...base, name: 'B' });
    const c = await createExercise({ ...base, name: 'C' });

    await reorderExercises([c.id, a.id, b.id]);
    expect((await listExercises()).map((e) => e.name)).toEqual(['C', 'Straight leg raise', 'B']);
    expect((await listExercises()).map((e) => e.sortOrder)).toEqual([0, 1, 2]);
  });

  it('rejects a partial, duplicated or unknown id list and changes nothing', async () => {
    const a = await createExercise(base);
    const b = await createExercise({ ...base, name: 'B' });
    await expect(reorderExercises([a.id])).rejects.toThrow();
    await expect(reorderExercises([a.id, a.id])).rejects.toThrow();
    await expect(reorderExercises([a.id, b.id, 'ghost'])).rejects.toThrow();
    expect((await listExercises()).map((e) => e.name)).toEqual(['Straight leg raise', 'B']);
  });
});

describe('deleteExercise (API-TRN-005)', () => {
  it('removes the row but keeps the session snapshot', async () => {
    const created = await createExercise(base);
    const session = await saveSession({
      startedAt: '2026-10-12T05:00:00.000Z',
      endedAt: '2026-10-12T05:20:00.000Z',
      status: 'completed',
      totalDurationSeconds: 1200,
      results: [
        {
          exerciseId: created.id,
          exerciseName: created.name,
          plannedSets: 3,
          plannedReps: 10,
          plannedDurationSeconds: null,
          completedSets: 3,
          completedReps: 30,
          activeSeconds: 600,
          status: 'completed',
          intensity: 'light',
          sortOrder: 0,
        },
      ],
    });

    await deleteExercise(created.id);

    const rows = await getDb().then((db) =>
      db.query<{ exercise_name: string; exercise_id: string | null }>(
        'SELECT exercise_name, exercise_id FROM session_exercise_results WHERE session_id = ?',
        [session.id],
      ),
    );
    expect(rows[0]?.exercise_name).toBe('Straight leg raise');
    expect(rows[0]?.exercise_id).toBeNull();
  });

  it('throws NOT_FOUND for an unknown id', async () => {
    await expect(deleteExercise('missing')).rejects.toThrow();
  });
});

describe('exercises.changed (EVT-TRN-002)', () => {
  it('fires exactly once per mutation', async () => {
    const handler = jest.fn();
    const off = appEvents.on('exercises.changed', handler);

    const created = await createExercise(base);
    expect(handler).toHaveBeenCalledTimes(1);

    await updateExercise(created.id, { sets: 4 });
    expect(handler).toHaveBeenCalledTimes(2);

    await reorderExercises([created.id]);
    expect(handler).toHaveBeenCalledTimes(3);

    await deleteExercise(created.id);
    expect(handler).toHaveBeenCalledTimes(4);

    off();
  });
});

describe('persistence round-trip (GAT-003, DATA_MODEL §5)', () => {
  it('reads back every stored field unchanged', async () => {
    const created = await createExercise(base);
    const read = await getExercise(created.id);
    expect(read).toEqual(created);
  });

  it('does not leak rows between two separate databases', async () => {
    await createExercise(base);
    setDbForTesting(await createTestDb());
    expect(await listExercises()).toEqual([]);
  });
});