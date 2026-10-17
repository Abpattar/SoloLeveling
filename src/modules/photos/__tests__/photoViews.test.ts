/** @jest-environment node */
import { getDayNumber } from '@/shared/utils/dates';
import {
  buildComparisonPairs,
  buildMilestoneStates,
  buildPhotoViews,
  buildTimelineSlots,
} from '../domain/photoViews';
import type { JourneyLockContext, ProgressPhotoRow } from '../domain/photoViews';
import { getMilestoneUnlockDate } from '../domain/milestones';
import type { Journey, MilestoneDay } from '@/shared/types/photos';

const START = '2026-01-01';
const resolveUri = (path: string) => `file:///private/${path}`;

function journey(overrides: Partial<Journey> = {}): Journey {
  return {
    id: 'j1',
    number: 1,
    startDate: START,
    status: 'active',
    completedOn: null,
    createdAt: 'x',
    updatedAt: 'x',
    ...overrides,
  };
}

function context(
  today: string,
  earlyUnlockedDays: MilestoneDay[] = [],
): JourneyLockContext {
  return { journey: journey(), today, earlyUnlockedDays };
}

/** A photo `dayNumber` days after Day 1, so Day 1 === dayNumber 1. */
function row(id: string, dayNumber: number, overrides: Partial<ProgressPhotoRow> = {}): ProgressPhotoRow {
  const capturedOn = dayNumber === 1 ? START : addDaysLocal(dayNumber - 1);
  return {
    id,
    journeyId: 'j1',
    imagePath: `progress/${id}.jpg`,
    capturedAt: `${capturedOn}T12:00:00.000Z`,
    capturedOn,
    sessionId: null,
    category: null,
    ...overrides,
  };
}

function addDaysLocal(n: number): string {
  const [y, m, d] = START.split('-').map((part) => Number.parseInt(part, 10));
  const next = new Date(Date.UTC(y, m - 1, d + n));
  const pad = (v: number) => (v < 10 ? `0${v}` : String(v));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

describe('buildPhotoViews (SEC-08, GAT-021)', () => {
  it('computes the day number and hides the photo before its milestone', () => {
    const views = buildPhotoViews([row('a', 5)], context(addDaysLocal(5)), resolveUri);
    expect(views).toHaveLength(1);
    expect(views[0]?.dayNumber).toBe(5);
    expect(views[0]?.unlockMilestone).toBe(30);
    expect(views[0]?.visible).toBe(false);
  });

it('never exposes the path or a URI of a locked photo', () => {
const views = buildPhotoViews(
[row('a', 5), row('c', 120)],
context(addDaysLocal(5)),
resolveUri,
);
const locked = views.find((v) => v.id === 'a');
expect(locked?.imageUri).toBeNull();
expect(JSON.stringify(locked)).not.toContain('progress/a.jpg');
});

it('only ever calls resolveUri for a visible photo', () => {
const seen: string[] = [];
buildPhotoViews([row('a', 1), row('b', 2), row('c', 5)], context(addDaysLocal(5)), (p) => {
seen.push(p);
return resolveUri(p);
});
expect(seen).toEqual([]);
});

it('calls resolveUri exactly once per visible photo', () => {
const seen: string[] = [];
buildPhotoViews([row('c', 120), row('d', 121)], context(addDaysLocal(121)), (p) => {
seen.push(p);
return resolveUri(p);
});
expect(seen).toEqual(['progress/c.jpg', 'progress/d.jpg']);
});

  it('shows a photo after Day 90 straight away', () => {
    const views = buildPhotoViews([row('c', 120)], context(addDaysLocal(120)), resolveUri);
    expect(views[0]?.unlockMilestone).toBeNull();
    expect(views[0]?.visible).toBe(true);
    expect(views[0]?.imageUri).toBe('file:///private/progress/c.jpg');
  });

  it('reveals a photo once its milestone date arrives', () => {
    const unlockDate = getMilestoneUnlockDate(START, 30);
    const views = buildPhotoViews([row('a', 5)], context(unlockDate), resolveUri);
    expect(views[0]?.visible).toBe(true);
    expect(views[0]?.imageUri).not.toBeNull();
  });

  it('reveals a photo through an early unlock', () => {
    const views = buildPhotoViews([row('a', 5)], context(addDaysLocal(5), [30]), resolveUri);
    expect(views[0]?.visible).toBe(true);
  });

  it('sorts by capture time ascending', () => {
    const views = buildPhotoViews(
      [row('b', 10), row('a', 1), row('c', 5)],
      context(addDaysLocal(100)),
      resolveUri,
    );
    expect(views.map((v) => v.id)).toEqual(['a', 'c', 'b']);
  });

  it('maps each row onto Day N = capturedOn minus startDate plus one', () => {
    const views = buildPhotoViews([row('a', 1)], context(START), resolveUri);
    expect(getDayNumber(START, views[0]!.capturedOn)).toBe(1);
  });
});

describe('buildMilestoneStates (GAT-021, GAT-022)', () => {
  it('reports lock state, unlock date and the locked photo count', () => {
    const rows = [row('a', 5), row('b', 10), row('c', 35)];
    const views = buildPhotoViews(rows, context(addDaysLocal(10)), resolveUri);
    const states = buildMilestoneStates(views, context(addDaysLocal(10)));

    expect(states.map((s) => s.day)).toEqual([30, 60, 90]);
    expect(states[0]).toMatchObject({
      unlocked: false,
      unlockedEarly: false,
      isNextPending: true,
      lockedPhotoCount: 2,
    });
    expect(states[0]?.unlockDate).toBe(getMilestoneUnlockDate(START, 30));
    expect(states[1]?.lockedPhotoCount).toBe(1);
  });

  it('marks an early unlock and never counts already-visible photos as locked', () => {
    const views = buildPhotoViews([row('a', 5)], context(addDaysLocal(5), [30]), resolveUri);
    const states = buildMilestoneStates(views, context(addDaysLocal(5), [30]));
    expect(states[0]).toMatchObject({ unlocked: true, unlockedEarly: true, lockedPhotoCount: 0 });
    expect(states[1]?.isNextPending).toBe(true);
  });

  it('has no next pending milestone once all three are unlocked', () => {
    const views = buildPhotoViews([], context(addDaysLocal(200)), resolveUri);
    const states = buildMilestoneStates(views, context(addDaysLocal(200)));
    expect(states.every((s) => s.isNextPending)).toBe(false);
  });
});

describe('buildComparisonPairs (GAT-032)', () => {
  it('is unavailable with no photos at all', () => {
    const pairs = buildComparisonPairs([], context(addDaysLocal(10)));
    expect(pairs.every((p) => !p.available)).toBe(true);
    expect(pairs.every((p) => p.baseline === null && p.target === null)).toBe(true);
  });

  it('has no baseline while the earliest photo is still locked', () => {
    const views = buildPhotoViews([row('a', 1)], context(addDaysLocal(1)), resolveUri);
    const pairs = buildComparisonPairs(views, context(addDaysLocal(1)));
    expect(pairs[0]?.baseline).toBeNull();
    expect(pairs[0]?.available).toBe(false);
  });

it('picks the earliest VISIBLE photo as the baseline', () => {
const rows = [row('early', 1), row('later', 40)];
// On Day 40 the Day-1 photo is already visible (its milestone is Day 30), so it is the baseline.
const views = buildPhotoViews(rows, context(addDaysLocal(40)), resolveUri);
const pairs = buildComparisonPairs(views, context(addDaysLocal(40)));
expect(pairs[0]?.baseline?.id).toBe('early');
});

it('skips a locked earliest photo when choosing the baseline', () => {
const rows = [row('locked1', 1), row('locked2', 2), row('visible', 3)];
// On Day 5 nothing is unlocked, so there is no baseline at all yet.
const early = buildPhotoViews(rows, context(addDaysLocal(5)), resolveUri);
expect(buildComparisonPairs(early, context(addDaysLocal(5)))[0]?.baseline).toBeNull();

// After a Day-30 early unlock all three are visible; the earliest of them is the baseline.
const unlocked = buildPhotoViews(rows, context(addDaysLocal(5), [30]), resolveUri);
const pairs = buildComparisonPairs(unlocked, context(addDaysLocal(5), [30]));
expect(pairs[0]?.baseline?.id).toBe('locked1');
});

  it('targets the greatest day number inside each milestone window', () => {
    const rows = [row('d1', 1), row('d15', 15), row('d30', 30), row('d45', 45), row('d70', 70)];
    const views = buildPhotoViews(rows, context(addDaysLocal(200)), resolveUri);
    const pairs = buildComparisonPairs(views, context(addDaysLocal(200)));

    expect(pairs[0]?.milestone).toBe(30);
    expect(pairs[0]?.target?.id).toBe('d30');
    expect(pairs[0]?.available).toBe(true);
    expect(pairs[1]?.target?.id).toBe('d45');
    expect(pairs[2]?.target?.id).toBe('d70');
  });

  it('treats the baseline photo as no target when it is the only one in the window', () => {
    const views = buildPhotoViews([row('d1', 1)], context(addDaysLocal(200)), resolveUri);
    const pairs = buildComparisonPairs(views, context(addDaysLocal(200)));
    expect(pairs[0]?.baseline?.id).toBe('d1');
    expect(pairs[0]?.target).toBeNull();
    expect(pairs[0]?.available).toBe(false);
  });

  it('never offers a locked photo as a baseline or target', () => {
    const views = buildPhotoViews([row('d1', 1), row('d5', 5)], context(addDaysLocal(5)), resolveUri);
    const pairs = buildComparisonPairs(views, context(addDaysLocal(5)));
    for (const pair of pairs) {
      if (pair.baseline) {
        expect(pair.baseline.visible).toBe(true);
      }
      if (pair.target) {
        expect(pair.target.visible).toBe(true);
      }
    }
  });
});

describe('buildTimelineSlots (GAT-032)', () => {
  it('matches only exact day numbers', () => {
    const views = buildPhotoViews([row('d10', 10), row('d11', 11)], context(addDaysLocal(200)), resolveUri);
    const slots = buildTimelineSlots(views, [1, 10, 60]);
    expect(slots.map((s) => s.day)).toEqual([1, 10, 60]);
    expect(slots[0]?.photo).toBeNull();
    expect(slots[1]?.photo?.id).toBe('d10');
    expect(slots[2]?.photo).toBeNull();
  });

  it('reports an empty slot for a day whose photo is locked', () => {
    const views = buildPhotoViews([row('d10', 10)], context(addDaysLocal(10)), resolveUri);
    const slots = buildTimelineSlots(views, [10]);
    expect(slots[0]?.photo).toBeNull();
  });

  it('returns the photo for a visible exact-day match', () => {
    const views = buildPhotoViews([row('d30', 30)], context(addDaysLocal(30)), resolveUri);
    const slots = buildTimelineSlots(views, [30]);
    expect(slots[0]?.photo?.id).toBe('d30');
  });
});