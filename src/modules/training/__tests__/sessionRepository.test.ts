/** @jest-environment node */
import { createTestDb } from '@/shared/db/testing/createTestDb';
import { getDb, setDbForTesting } from '@/shared/db/database';
import { appEvents } from '@/shared/events/appEvents';
import { updateProfile } from '@/shared/data/profileRepository';
import {
  deleteSession,
  getCompletedSessionCountsByDate,
  getSession,
  getSessionDayStatus,
  listSessions,
  listSessionsForDate,
  saveSession,
  updateSessionReflection,
} from '../data/sessionRepository';
import { createExercise, getExercise, listExercisesScheduledFor, updateExercise } from '../data/exerciseRepository';
import type { SaveSessionInput, Weekday } from '@/shared/types/training';

function makeSession(overrides: Partial<SaveSessionInput> = {}): SaveSessionInput {
  return {
    startedAt: '2026-10-12T12:00:00.000Z',
    endedAt: '2026-10-12T12:20:00.000Z',
    status: 'completed',
    totalDurationSeconds: 1200,
    results: [
      {
        exerciseId: null,
        exerciseName: 'Straight leg raise',
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
    ...overrides,
  };
}

beforeEach(async () => {
  setDbForTesting(await createTestDb());
});

afterEach(() => {
  setDbForTesting(null);
});

describe('saveSession (API-TRN-008)', () => {
  it('round-trips the session and its results', async () => {
    const session = await saveSession(makeSession());
    const read = await getSession(session.id);
    expect(read.status).toBe('completed');
    expect(read.totalDurationSeconds).toBe(1200);
    expect(read.localDate).toBe('2026-10-12');
    expect(read.results).toHaveLength(1);
    expect(read.results[0]).toMatchObject({
      exerciseName: 'Straight leg raise',
      plannedSets: 3,
      completedSets: 3,
      completedReps: 30,
      activeSeconds: 600,
      status: 'completed',
      intensity: 'light',
    });
    expect(read.effortRating).toBeNull();
    expect(read.symptomFlags).toEqual([]);
  });

it('derives localDate from startedAt, not endedAt', async () => {
const session = await saveSession(
makeSession({
startedAt: '2026-10-12T12:00:00.000Z',
endedAt: '2026-10-13T12:00:00.000Z',
}),
);
expect(session.localDate).toBe('2026-10-12');
});

  it('requires at least one result', async () => {
    await expect(saveSession(makeSession({ results: [] }))).rejects.toThrow();
  });

  it('rejects an end before the start and negative counts', async () => {
    await expect(
      saveSession(makeSession({ startedAt: '2026-10-12T12:30:00.000Z', endedAt: '2026-10-12T12:00:00.000Z' })),
    ).rejects.toThrow();
    await expect(saveSession(makeSession({ totalDurationSeconds: -1 }))).rejects.toThrow();
    await expect(
      saveSession(
        makeSession({
          results: [{ ...makeSession().results[0]!, completedSets: -1 }],
        }),
      ),
    ).rejects.toThrow();
  });

  it('rejects an unknown status and an unknown result status', async () => {
    await expect(saveSession(makeSession({ status: 'paused' as never }))).rejects.toThrow();
    await expect(
      saveSession(
        makeSession({ results: [{ ...makeSession().results[0]!, status: 'unknown' as never }] }),
      ),
    ).rejects.toThrow();
  });

  it('writes nothing when one result is invalid', async () => {
    await expect(
      saveSession(
        makeSession({
          results: [
            makeSession().results[0]!,
            { ...makeSession().results[0]!, exerciseName: '   ', sortOrder: 1 },
          ],
        }),
      ),
    ).rejects.toThrow();
    const db = await getDb();
    expect(await db.query('SELECT * FROM sessions')).toHaveLength(0);
    expect(await db.query('SELECT * FROM session_exercise_results')).toHaveLength(0);
  });

  it('emits session.saved once, with the local date and status', async () => {
    const handler = jest.fn();
    const off = appEvents.on('session.saved', handler);

    const session = await saveSession(makeSession());

    off();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      sessionId: session.id,
      localDate: '2026-10-12',
      status: 'completed',
    });
    // The rows are readable immediately after saveSession returns, i.e. the emit happened post-commit.
    expect((await getSession(session.id)).results).toHaveLength(1);
  });

  it('emits nothing when the transaction rolls back', async () => {
    const handler = jest.fn();
    const off = appEvents.on('session.saved', handler);
    await expect(saveSession(makeSession({ results: [] }))).rejects.toThrow();
    off();
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('estimated workout calories (API-TRN-008 via API-ACT-002, GAT-031)', () => {
  it('is null when no weight is known', async () => {
    const session = await saveSession(makeSession());
    expect(session.estimatedKcal).toBeNull();
  });

  it('uses the profile baseline weight', async () => {
    await updateProfile({ baselineWeightKg: 70 });
    const session = await saveSession(makeSession());
    // light 2.5 MET x 70 kg x 600 s / 3600 = 29.17 -> 29
    expect(session.estimatedKcal).toBe(29);
  });

  it('prefers the newest weight measurement over the baseline', async () => {
    await updateProfile({ baselineWeightKg: 70 });
    const db = await getDb();
    await db.execute(
      `INSERT INTO measurements (id, type, value, unit, measured_at, local_date, created_at)
       VALUES ('m1', 'weight', 80, 'kg', '2026-10-01T00:00:00.000Z', '2026-10-01', '2026-10-01T00:00:00.000Z')`,
    );
    const session = await saveSession(makeSession());
    // 2.5 x 80 x 600 / 3600 = 33.33 -> 33
    expect(session.estimatedKcal).toBe(33);
  });

  it('is null when the exercise has no intensity', async () => {
    await updateProfile({ baselineWeightKg: 70 });
    const session = await saveSession(
      makeSession({ results: [{ ...makeSession().results[0]!, intensity: null }] }),
    );
    expect(session.estimatedKcal).toBeNull();
  });
});

describe('listSessions (API-TRN-010, API-TRN-011)', () => {
  beforeEach(async () => {
    await saveSession(makeSession());
    await saveSession(
      makeSession({
        startedAt: '2026-10-13T12:00:00.000Z',
        endedAt: '2026-10-13T12:10:00.000Z',
        status: 'stopped',
      }),
    );
    await saveSession(
      makeSession({
        startedAt: '2026-10-14T12:00:00.000Z',
        endedAt: '2026-10-14T12:10:00.000Z',
      }),
    );
  });

  it('returns newest first', async () => {
    const all = await listSessions();
    expect(all.map((s) => s.localDate)).toEqual(['2026-10-14', '2026-10-13', '2026-10-12']);
  });

  it('filters by date range', async () => {
    expect((await listSessions({ from: '2026-10-13', to: '2026-10-13' })).map((s) => s.status)).toEqual([
      'stopped',
    ]);
    expect(await listSessions({ from: '2026-10-15' })).toEqual([]);
  });

  it('honours the limit', async () => {
    expect(await listSessions({ limit: 2 })).toHaveLength(2);
  });

  it('lists one date exactly', async () => {
    expect(await listSessionsForDate('2026-10-13')).toHaveLength(1);
    expect(await listSessionsForDate('2026-10-20')).toEqual([]);
  });

  it('rejects invalid dates', async () => {
    await expect(listSessions({ from: 'nope' })).rejects.toThrow();
    await expect(listSessionsForDate('2026-02-30')).rejects.toThrow();
  });
});

describe('updateSessionReflection (API-TRN-012, GAT-009)', () => {
  it('stores effort, notes, pain and symptom flags', async () => {
    const session = await saveSession(makeSession());
    const updated = await updateSessionReflection(session.id, {
      effortRating: 6,
      notes: 'Felt steady',
      painScore: 3,
      symptomFlags: ['new_swelling'],
    });
    expect(updated.effortRating).toBe(6);
    expect(updated.notes).toBe('Felt steady');
    expect(updated.painScore).toBe(3);
    expect(updated.symptomFlags).toEqual(['new_swelling']);
  });

  it('enforces the 1-10 effort and 0-10 pain bounds and writes nothing on failure', async () => {
    const session = await saveSession(makeSession());
    await expect(updateSessionReflection(session.id, { effortRating: 0 })).rejects.toThrow();
    await expect(updateSessionReflection(session.id, { effortRating: 11 })).rejects.toThrow();
    await expect(updateSessionReflection(session.id, { painScore: -1 })).rejects.toThrow();
    await expect(updateSessionReflection(session.id, { painScore: 11 })).rejects.toThrow();
    await expect(
      updateSessionReflection(session.id, { notes: 'x'.repeat(2001) }),
    ).rejects.toThrow();
    expect((await getSession(session.id)).effortRating).toBeNull();
  });

it('never changes the exercise plan (GAT-005)', async () => {
const exercise = await createExercise({
name: 'Straight leg raise',
sets: 3,
reps: 10,
restSeconds: 60,
scheduleDays: [1] as Weekday[],
intensity: 'light',
});
const before = await getExercise(exercise.id);
const session = await saveSession(makeSession());

await updateSessionReflection(session.id, { symptomFlags: ['giving_way'], painScore: 9 });

const after = await getExercise(exercise.id);
expect(after).toEqual(before);
expect(after.sets).toBe(3);
expect(after.reps).toBe(10);
expect(after.restSeconds).toBe(60);
expect(after.scheduleDays).toEqual([1]);
expect(after.intensity).toBe('light');
expect(after.status).toBe('active');
});
});

describe('deleteSession (API-TRN-013)', () => {
  it('removes the session and cascades its results', async () => {
    const session = await saveSession(makeSession());
    await deleteSession(session.id);
    await expect(getSession(session.id)).rejects.toThrow();
    const db = await getDb();
    expect(await db.query('SELECT * FROM session_exercise_results')).toHaveLength(0);
  });

  it('throws NOT_FOUND for an unknown id', async () => {
    await expect(deleteSession('missing')).rejects.toThrow();
  });
});

describe('getSessionDayStatus (API-TRN-014)', () => {
  it('counts scheduled exercises, completed and stopped sessions', async () => {
    await createExercise({
      name: 'A',
      sets: 1,
      reps: 5,
      scheduleDays: [1] as Weekday[],
    });
    await saveSession(makeSession());
    await saveSession(
      makeSession({ startedAt: '2026-10-12T12:30:00.000Z', endedAt: '2026-10-12T12:40:00.000Z', status: 'stopped' }),
    );

    const status = await getSessionDayStatus('2026-10-12');
    expect(status.scheduledExerciseCount).toBe(1);
    expect(status.completedSessionCount).toBe(1);
    expect(status.stoppedSessionCount).toBe(1);
    expect(status.localDate).toBe('2026-10-12');
  });

  it('returns zeros for a day with nothing', async () => {
    expect(await getSessionDayStatus('2026-10-20')).toEqual({
      localDate: '2026-10-20',
      scheduledExerciseCount: 0,
      completedSessionCount: 0,
      stoppedSessionCount: 0,
    });
  });
});

describe('getCompletedSessionCountsByDate (API-TRN-015)', () => {
  it('counts only completed sessions per date', async () => {
    await saveSession(makeSession());
    await saveSession(
      makeSession({
        startedAt: '2026-10-13T12:00:00.000Z',
        endedAt: '2026-10-13T12:10:00.000Z',
        status: 'stopped',
      }),
    );
    expect(
      await getCompletedSessionCountsByDate('2026-10-12', '2026-10-14'),
    ).toEqual({ '2026-10-12': 1 });
  });

  it('rejects an invalid range', async () => {
    await expect(getCompletedSessionCountsByDate('2026-02-30', '2026-03-01')).rejects.toThrow();
  });
});

describe('scheduled exercises feed the day status (integration with API-TRN-007)', () => {
  it('excludes a paused exercise from the scheduled count', async () => {
    const exercise = await createExercise({
      name: 'A',
      sets: 1,
      reps: 5,
      scheduleDays: [1] as Weekday[],
    });
    expect((await getSessionDayStatus('2026-10-12')).scheduledExerciseCount).toBe(1);
    await updateExercise(exercise.id, { status: 'paused' });
    expect((await getSessionDayStatus('2026-10-12')).scheduledExerciseCount).toBe(0);
    expect(await listExercisesScheduledFor('2026-10-12')).toEqual([]);
  });
});