/** @jest-environment node */
import { createTestDb } from '@/shared/db/testing/createTestDb';
import { getDb, setDbForTesting } from '@/shared/db/database';
import { addDays, todayLocal } from '@/shared/utils/dates';
import {
  createFirstJourney,
  getActiveJourney,
  listJourneys,
  startNextJourney,
  updateJourneyStartDate,
} from '../data/journeyRepository';
import { addProgressPhoto, listProgressPhotos } from '../data/photoRepository';

jest.mock('@/shared/files/photoStorage', () => ({
  savePhotoFromUri: jest.fn(async ({ id }: { id: string }) => ({
    relativePath: `progress/${id}.jpg`,
    byteSize: 10,
  })),
  deletePhoto: jest.fn(async () => undefined),
  resolvePhotoUri: (p: string) => `file:///private/${p}`,
  photoExists: jest.fn(async () => true),
}));

const START = addDays(todayLocal(), -200); // far enough back that Day 90 has passed

beforeEach(async () => {
  setDbForTesting(await createTestDb());
});

afterEach(() => {
  setDbForTesting(null);
});

describe('createFirstJourney (API-PHOTO-002)', () => {
  it('creates Journey 1 as active', async () => {
    const journey = await createFirstJourney(START);
    expect(journey.number).toBe(1);
    expect(journey.status).toBe('active');
    expect(journey.completedOn).toBeNull();
    expect(await getActiveJourney()).toEqual(journey);
  });

  it('accepts today as Day 1', async () => {
    expect((await createFirstJourney(todayLocal())).startDate).toBe(todayLocal());
  });

  it('rejects a future or invalid start date', async () => {
    await expect(createFirstJourney(addDays(todayLocal(), 1))).rejects.toThrow();
    await expect(createFirstJourney('2026-02-30')).rejects.toThrow();
  });

  it('rejects a second journey with CONFLICT', async () => {
    await createFirstJourney(START);
    await expect(createFirstJourney(START)).rejects.toThrow();
    expect(await listJourneys()).toHaveLength(1);
  });
});

describe('getActiveJourney / listJourneys (API-PHOTO-001, API-PHOTO-003)', () => {
  it('returns null when there is no journey', async () => {
    expect(await getActiveJourney()).toBeNull();
    expect(await listJourneys()).toEqual([]);
  });

  it('lists journeys in ascending number', async () => {
    await createFirstJourney(START);
    await startNextJourney();
    expect((await listJourneys()).map((j) => j.number)).toEqual([1, 2]);
  });
});

describe('startNextJourney (API-PHOTO-005, GAT-026)', () => {
  it('is rejected before Day 90 is unlocked', async () => {
    await createFirstJourney(todayLocal());
    await expect(startNextJourney()).rejects.toThrow();
    expect(await listJourneys()).toHaveLength(1);
  });

  it('is allowed once Day 90 has passed', async () => {
    await createFirstJourney(START);
    const next = await startNextJourney();
    expect(next.number).toBe(2);
    expect(next.status).toBe('active');
    expect(next.startDate).toBe(todayLocal());

    const previous = (await listJourneys())[0];
    expect(previous?.status).toBe('completed');
    expect(previous?.completedOn).toBe(todayLocal());
  });

  it('keeps exactly one active journey', async () => {
    await createFirstJourney(START);
    await startNextJourney();
    const db = await getDb();
    const rows = await db.query<{ n: number }>(
      "SELECT COUNT(*) AS n FROM journeys WHERE status = 'active'",
    );
    expect(Number(rows[0]?.n)).toBe(1);
  });

it('increments the number each time the previous 90 days have passed', async () => {
await createFirstJourney(START);
await startNextJourney();
expect((await listJourneys()).map((j) => j.number)).toEqual([1, 2]);
});

it('allows the next journey once the second journey\'s Day 90 arrives', async () => {
jest.useFakeTimers();
try {
const realNow = new Date();
jest.setSystemTime(realNow);
await createFirstJourney(START);
await startNextJourney();
await expect(startNextJourney()).rejects.toThrow();

jest.setSystemTime(new Date(realNow.getTime() + 91 * 86_400_000));
const third = await startNextJourney();
expect(third.number).toBe(3);
expect(third.status).toBe('active');
expect((await listJourneys()).map((j) => j.number)).toEqual([1, 2, 3]);
} finally {
jest.useRealTimers();
}
});

  it('rejects with CONFLICT when no journey is active', async () => {
    await expect(startNextJourney()).rejects.toThrow();
  });
});

describe('updateJourneyStartDate (API-PHOTO-004, GAT-025)', () => {
  it('moves Day 1 and keeps early unlocks', async () => {
    const journey = await createFirstJourney(START);
    await (await getDb()).execute(
      "INSERT INTO early_unlocks (journey_id, milestone_day, unlocked_at) VALUES (?, 30, 'x')",
      [journey.id],
    );

    const updated = await updateJourneyStartDate(journey.id, addDays(START, 10));
    expect(updated.startDate).toBe(addDays(START, 10));

    const unlocks = await (await getDb()).query('SELECT * FROM early_unlocks');
    expect(unlocks).toHaveLength(1);
  });

  it('rejects a future date', async () => {
    const journey = await createFirstJourney(START);
    await expect(updateJourneyStartDate(journey.id, addDays(todayLocal(), 1))).rejects.toThrow();
  });

it('rejects a start date that would push an existing photo before Day 1', async () => {
const fiveDaysAgo = addDays(todayLocal(), -5);
const journey = await createFirstJourney(fiveDaysAgo);
await addProgressPhoto({
tempImageUri: 'file:///tmp/x.jpg',
capturedAt: `${fiveDaysAgo}T12:00:00.000Z`,
});
// The photo was Day 1; moving Day 1 to today would put it four days before the journey started.
await expect(updateJourneyStartDate(journey.id, todayLocal())).rejects.toThrow();
expect((await listJourneys())[0]?.startDate).toBe(fiveDaysAgo);
});

it('allows moving Day 1 earlier, which only raises every day number', async () => {
const fiveDaysAgo = addDays(todayLocal(), -5);
const journey = await createFirstJourney(fiveDaysAgo);
await addProgressPhoto({
tempImageUri: 'file:///tmp/x.jpg',
capturedAt: `${fiveDaysAgo}T12:00:00.000Z`,
});
expect((await listProgressPhotos(journey.id))[0]?.dayNumber).toBe(1);

const updated = await updateJourneyStartDate(journey.id, addDays(fiveDaysAgo, -2));
expect(updated.startDate).toBe(addDays(fiveDaysAgo, -2));
expect((await listProgressPhotos(journey.id))[0]?.dayNumber).toBe(3);
});

  it('rejects a start date before the previous journey finished', async () => {
    await createFirstJourney(START);
    const second = await startNextJourney();
    await expect(updateJourneyStartDate(second.id, addDays(START, -5))).rejects.toThrow();
  });

  it('allows a start date equal to the previous journey completion date', async () => {
    await createFirstJourney(START);
    const second = await startNextJourney();
    const updated = await updateJourneyStartDate(second.id, todayLocal());
    expect(updated.startDate).toBe(todayLocal());
  });

  it('rejects an invalid date and an unknown journey', async () => {
    const journey = await createFirstJourney(START);
    await expect(updateJourneyStartDate(journey.id, '2026-02-30')).rejects.toThrow();
    await expect(updateJourneyStartDate('missing', START)).rejects.toThrow();
  });

it('recomputes day numbers without changing the stored photo or its capture date', async () => {
const journey = await createFirstJourney(START);
await addProgressPhoto({
tempImageUri: 'file:///tmp/x.jpg',
capturedAt: `${START}T12:00:00.000Z`,
});
const before = await listProgressPhotos(journey.id);
expect(before[0]?.dayNumber).toBe(1);

// Moving Day 1 earlier raises every day number by the same amount.
await updateJourneyStartDate(journey.id, addDays(START, -5));
const after = await listProgressPhotos(journey.id);
expect(after[0]?.dayNumber).toBe(6);
expect(after[0]?.capturedOn).toBe(before[0]?.capturedOn);
expect(after[0]?.capturedAt).toBe(before[0]?.capturedAt);
expect(after[0]?.unlockMilestone).toBe(30);
});
});

describe('journeys + photos together (GAT-026)', () => {
  it('restarts the locks in the new journey and leaves the old photos visible', async () => {
    const first = await createFirstJourney(START);
    await addProgressPhoto({
      tempImageUri: 'file:///tmp/x.jpg',
      capturedAt: `${START}T12:00:00.000Z`,
    });
    const second = await startNextJourney();
    await addProgressPhoto({ tempImageUri: 'file:///tmp/y.jpg' });

    const oldPhotos = await listProgressPhotos(first.id);
    expect(oldPhotos).toHaveLength(1);
    expect(oldPhotos[0]?.visible).toBe(true);

    const newPhotos = await listProgressPhotos(second.id);
    expect(newPhotos).toHaveLength(1);
    expect(newPhotos[0]?.dayNumber).toBe(1);
    expect(newPhotos[0]?.unlockMilestone).toBe(30);
    expect(newPhotos[0]?.visible).toBe(false);
    expect(newPhotos[0]?.imageUri).toBeNull();
  });
});