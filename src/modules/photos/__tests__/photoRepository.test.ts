/** @jest-environment node */
import { createTestDb } from '@/shared/db/testing/createTestDb';
import { getDb, setDbForTesting } from '@/shared/db/database';
import { addDays, todayLocal } from '@/shared/utils/dates';
import { createFirstJourney, getActiveJourney, startNextJourney } from '../data/journeyRepository';
import {
  addProgressPhoto,
  deleteProgressPhoto,
  getComparisonPairs,
  getMilestoneStates,
  getTimelineSlots,
  listProgressPhotos,
  unlockMilestoneEarly,
} from '../data/photoRepository';
import { exportProgressPhoto } from '../services/photoExport';

const mockSaved: string[] = [];
const mockDeleted: string[] = [];
let mockFailSave = false;
let mockShareAvailable = true;
const mockShared: string[] = [];

jest.mock('@/shared/files/photoStorage', () => ({
savePhotoFromUri: jest.fn(async ({ id }: { id: string }) => {
if (mockFailSave) {
throw new Error('disk full');
}
const relativePath = `progress/${id}.jpg`;
mockSaved.push(relativePath);
return { relativePath, byteSize: 10 };
}),
deletePhoto: jest.fn(async (p: string) => {
mockDeleted.push(p);
}),
resolvePhotoUri: (p: string) => `file:///private/${p}`,
photoExists: jest.fn(async () => true),
}));

jest.mock('expo-sharing', () => ({
isAvailableAsync: jest.fn(async () => mockShareAvailable),
shareAsync: jest.fn(async (uri: string) => {
mockShared.push(uri);
}),
}));


beforeEach(async () => {
setDbForTesting(await createTestDb());
mockSaved.length = 0;
mockDeleted.length = 0;
mockShared.length = 0;
mockFailSave = false;
mockShareAvailable = true;
});

afterEach(() => {
setDbForTesting(null);
});

/** Creates Journey 1 starting `daysAgo` days back, with photos on the given day numbers. */
async function seed(daysAgo: number, dayNumbers: number[]) {
const start = addDays(todayLocal(), -daysAgo);
await createFirstJourney(start);
const journey = await getActiveJourney();
for (const dayNumber of dayNumbers) {
const capturedOn = dayNumber === 1 ? start : addDays(start, dayNumber - 1);
await addProgressPhoto({
tempImageUri: 'file:///tmp/x.jpg',
capturedAt: `${capturedOn}T12:00:00.000Z`,
});
}
return journey!;
}

describe('addProgressPhoto (API-PHOTO-006)', () => {
it('saves into the active journey and returns a locked view', async () => {
await createFirstJourney(todayLocal());
const created = await addProgressPhoto({ tempImageUri: 'file:///tmp/x.jpg' });
expect('imagePath' in created).toBe(false);
expect(created.imageUri).toBeNull();
expect(created.visible).toBe(false);
expect(created.dayNumber).toBe(1);
expect(created.unlockMilestone).toBe(30);
expect(mockSaved[0]).toBe(`progress/${created.id}.jpg`);
});

it('refuses when there is no active journey', async () => {
await expect(addProgressPhoto({ tempImageUri: 'file:///tmp/x.jpg' })).rejects.toThrow();
});

it('rejects a future capture time', async () => {
await createFirstJourney(todayLocal());
const future = new Date(Date.now() + 86_400_000).toISOString();
await expect(addProgressPhoto({ tempImageUri: 'file:///tmp/x.jpg', capturedAt: future })).rejects.toThrow();
});

it('saves the category and the session link', async () => {
await createFirstJourney(todayLocal());
await (await getDb()).execute(
`INSERT INTO sessions (id, started_at, ended_at, local_date, status, total_duration_seconds,
effort_rating, notes, pain_score, symptom_flags, estimated_kcal, created_at)
VALUES ('s1', ?, ?, ?, 'completed', 60, NULL, NULL, NULL, '[]', NULL, ?)`,
[`${todayLocal()}T12:00:00.000Z`, `${todayLocal()}T12:01:00.000Z`, todayLocal(), `${todayLocal()}T12:00:00.000Z`],
);
const created = await addProgressPhoto({
tempImageUri: 'file:///tmp/x.jpg',
category: 'front',
sessionId: 's1',
});
expect(created.category).toBe('front');
expect(created.sessionId).toBe('s1');
});

it('rejects a session id that does not exist', async () => {
await createFirstJourney(todayLocal());
await expect(
addProgressPhoto({ tempImageUri: 'file:///tmp/x.jpg', sessionId: 'ghost' }),
).rejects.toThrow();
});

it('writes no row and no file when the copy fails', async () => {
await createFirstJourney(todayLocal());
mockFailSave = true;
await expect(addProgressPhoto({ tempImageUri: 'file:///tmp/x.jpg' })).rejects.toThrow();
expect(await (await getDb()).query('SELECT * FROM progress_photos')).toHaveLength(0);
});

it('deletes the copied file when the insert fails', async () => {
await createFirstJourney(todayLocal());
const db = await getDb();
jest.spyOn(db, 'execute').mockImplementationOnce(async () => {
throw new Error('insert failed');
});
await expect(addProgressPhoto({ tempImageUri: 'file:///tmp/x.jpg' })).rejects.toThrow();
expect(mockDeleted).toHaveLength(1);
expect(await (await getDb()).query('SELECT * FROM progress_photos')).toHaveLength(0);
jest.restoreAllMocks();
});
});

describe('listProgressPhotos (API-PHOTO-007, GAT-021)', () => {
it('returns every photo, all locked with a null URI before Day 30', async () => {
const journey = await seed(10, [1, 5, 10]);
const photos = await listProgressPhotos(journey.id);
expect(photos).toHaveLength(3);
expect(photos.every((p) => p.visible === false)).toBe(true);
expect(photos.every((p) => p.imageUri === null)).toBe(true);
expect(JSON.stringify(photos)).not.toContain('progress/');
});

it('returns every photo, all visible once Day 90 has passed', async () => {
const journey = await seed(95, [1, 5, 92]);
const photos = await listProgressPhotos(journey.id);
expect(photos).toHaveLength(3);
expect(photos.every((p) => p.visible === true)).toBe(true);
expect(photos.every((p) => p.imageUri !== null)).toBe(true);
expect(photos.filter((p) => p.unlockMilestone === null)).toHaveLength(1);
});

it('never exposes an image_path on the view type', async () => {
const journey = await seed(10, [1]);
const [photo] = await listProgressPhotos(journey.id);
expect(Object.keys(photo ?? {}).sort()).toEqual(
[
'capturedAt',
'capturedOn',
'category',
'dayNumber',
'id',
'imageUri',
'journeyId',
'sessionId',
'unlockMilestone',
'visible',
].sort(),
);
expect(photo).not.toHaveProperty('imagePath');
});

it('reveals photos once Day 30 passes', async () => {
const journey = await seed(29, [1, 5]);
const photos = await listProgressPhotos(journey.id);
expect(photos.every((p) => p.visible)).toBe(true);
});

it('shows photos taken after Day 90 immediately', async () => {
const journey = await seed(200, [120]);
const photos = await listProgressPhotos(journey.id);
expect(photos[0]?.unlockMilestone).toBeNull();
expect(photos[0]?.visible).toBe(true);
expect(photos[0]?.imageUri).not.toBeNull();
});

it('sorts oldest first', async () => {
const journey = await seed(200, [120, 1, 40]);
const photos = await listProgressPhotos(journey.id);
expect(photos.map((p) => p.dayNumber)).toEqual([1, 40, 120]);
});
});

describe('getMilestoneStates (API-PHOTO-008)', () => {
it('counts only the photos locked behind each milestone', async () => {
// 10 days in: every photo taken so far is locked behind Day 30.
const journey = await seed(10, [1, 5, 10]);
const states = await getMilestoneStates(journey.id);
const byDay = new Map(states.map((s) => [s.day, s]));
expect(byDay.get(30)?.lockedPhotoCount).toBe(3);
expect(byDay.get(60)?.lockedPhotoCount).toBe(0);
expect(byDay.get(90)?.lockedPhotoCount).toBe(0);
expect(byDay.get(30)?.unlocked).toBe(false);
expect(byDay.get(30)?.isNextPending).toBe(true);
});

it('marks exactly one next-pending milestone', async () => {
const journey = await seed(5, [1]);
const states = await getMilestoneStates(journey.id);
expect(states.filter((s) => s.isNextPending)).toHaveLength(1);
expect(states.find((s) => s.isNextPending)?.day).toBe(30);
});
});

describe('unlockMilestoneEarly (API-PHOTO-009, GAT-023, SEC-09)', () => {
it('is rejected without explicit confirmation', async () => {
const journey = await seed(5, [1]);
await expect(unlockMilestoneEarly(journey.id, 30, { confirmed: false })).rejects.toThrow();
const states = await getMilestoneStates(journey.id);
expect(states[0]?.unlocked).toBe(false);
});

it('is rejected when the milestone is not the next pending one', async () => {
const journey = await seed(5, [1]);
await expect(unlockMilestoneEarly(journey.id, 60, { confirmed: true })).rejects.toThrow();
await expect(unlockMilestoneEarly(journey.id, 90, { confirmed: true })).rejects.toThrow();
});

it('is rejected for a day that is not a milestone', async () => {
const journey = await seed(5, [1]);
await expect(unlockMilestoneEarly(journey.id, 45 as never, { confirmed: true })).rejects.toThrow();
});

it('unlocks the next pending milestone with confirmation', async () => {
const journey = await seed(5, [1, 2]);
await unlockMilestoneEarly(journey.id, 30, { confirmed: true });
const states = await getMilestoneStates(journey.id);
expect(states[0]).toMatchObject({ unlocked: true, unlockedEarly: true, lockedPhotoCount: 0 });
expect(states[1]?.isNextPending).toBe(true);
const photos = await listProgressPhotos(journey.id);
expect(photos.every((p) => p.visible)).toBe(true);
});

it('is rejected with CONFLICT once already unlocked', async () => {
const journey = await seed(5, [1]);
await unlockMilestoneEarly(journey.id, 30, { confirmed: true });
await expect(unlockMilestoneEarly(journey.id, 30, { confirmed: true })).rejects.toThrow();
});

it('lets Day 60 become the next pending after an early Day 30 unlock', async () => {
const journey = await seed(5, [1]);
await unlockMilestoneEarly(journey.id, 30, { confirmed: true });
await unlockMilestoneEarly(journey.id, 60, { confirmed: true });
const states = await getMilestoneStates(journey.id);
expect(states[0]?.unlockedEarly).toBe(true);
expect(states[1]?.unlockedEarly).toBe(true);
expect(states[2]?.isNextPending).toBe(true);
});
});

describe('deleteProgressPhoto (API-PHOTO-010, GAT-043)', () => {
it('removes the row and the file', async () => {
const journey = await seed(200, [120]);
const [photo] = await listProgressPhotos(journey.id);
await deleteProgressPhoto(photo!.id);
expect(await (await getDb()).query('SELECT * FROM progress_photos')).toHaveLength(0);
expect(mockDeleted).toContain(`progress/${photo!.id}.jpg`);
});

it('throws NOT_FOUND for an unknown id', async () => {
await expect(deleteProgressPhoto('missing')).rejects.toThrow();
});
});

describe('getComparisonPairs / getTimelineSlots (API-PHOTO-012, API-PHOTO-013)', () => {
it('gives no baseline while everything is locked', async () => {
const journey = await seed(5, [1, 2]);
const pairs = await getComparisonPairs(journey.id);
expect(pairs.every((p) => p.baseline === null)).toBe(true);
});

it('pairs the earliest photo with the last one in the window', async () => {
const journey = await seed(200, [1, 15, 30, 45]);
const pairs = await getComparisonPairs(journey.id);
expect(pairs[0]?.baseline?.dayNumber).toBe(1);
expect(pairs[0]?.target?.dayNumber).toBe(30);
expect(pairs[0]?.available).toBe(true);
expect(pairs[1]?.target?.dayNumber).toBe(45);
});

it('returns only exact-day visible photos in the timeline', async () => {
const journey = await seed(200, [1, 10, 120]);
const slots = await getTimelineSlots(journey.id, [1, 10, 30]);
expect(slots[0]?.photo?.dayNumber).toBe(1);
expect(slots[1]?.photo?.dayNumber).toBe(10);
expect(slots[2]?.photo).toBeNull();
});

it('reports an empty slot for a locked day', async () => {
const journey = await seed(10, [5]);
const slots = await getTimelineSlots(journey.id, [5]);
expect(slots[0]?.photo).toBeNull();
});
});

describe('exportProgressPhoto (API-PHOTO-011, GAT-043)', () => {
it('refuses a locked photo and never resolves its path', async () => {
const journey = await seed(5, [1]);
const [photo] = await listProgressPhotos(journey.id);
const result = await exportProgressPhoto(photo!.id);
expect(result.ok).toBe(false);
if (!result.ok) {
expect(result.error.code).toBe('LOCKED');
expect(result.error.message).toMatch(/locked until/i);
}
expect(mockShared).toHaveLength(0);
});

it('shares a visible photo', async () => {
const journey = await seed(200, [120]);
const [photo] = await listProgressPhotos(journey.id);
const result = await exportProgressPhoto(photo!.id);
expect(result.ok).toBe(true);
expect(mockShared[0]).toBe(photo!.imageUri);
});

it('reports sharing being unavailable instead of failing silently', async () => {
const journey = await seed(200, [120]);
const [photo] = await listProgressPhotos(journey.id);
mockShareAvailable = false;
const result = await exportProgressPhoto(photo!.id);
expect(result.ok).toBe(false);
if (!result.ok) {
expect(result.error.code).toBe('UNSUPPORTED');
}
});

it('reports NOT_FOUND for an unknown id', async () => {
const result = await exportProgressPhoto('missing');
expect(result.ok).toBe(false);
if (!result.ok) {
expect(result.error.code).toBe('NOT_FOUND');
}
});
});

describe('a new journey restarts the locks (GAT-026)', () => {
it('locks photos taken in Journey 2 and keeps Journey 1 photos visible', async () => {
const first = await seed(200, [1, 120]);
const second = await startNextJourney();
await addProgressPhoto({ tempImageUri: 'file:///tmp/y.jpg' });

const oldPhotos = await listProgressPhotos(first.id);
expect(oldPhotos.every((p) => p.visible)).toBe(true);

const newPhotos = await listProgressPhotos(second.id);
expect(newPhotos[0]?.dayNumber).toBe(1);
expect(newPhotos[0]?.visible).toBe(false);
expect(newPhotos[0]?.imageUri).toBeNull();
});
});