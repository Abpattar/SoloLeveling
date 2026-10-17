/** @jest-environment node */
import {
  DEFAULT_TIMELINE_DAYS,
  getMilestoneUnlockDate,
  getNextPendingMilestone,
  getUnlockMilestoneForDay,
  isMilestoneUnlocked,
  MILESTONE_DAYS,
} from '../domain/milestones';
import { addDays } from '@/shared/utils/dates';

const START = '2026-01-01';

describe('MILESTONE_DAYS (CONST-PHOTO-001)', () => {
  it('is exactly 30, 60, 90', () => {
    expect(MILESTONE_DAYS).toEqual([30, 60, 90]);
  });

  it('defaults the timeline to 1, 10, 30, 60, 90', () => {
    expect(DEFAULT_TIMELINE_DAYS).toEqual([1, 10, 30, 60, 90]);
  });
});

describe('getMilestoneUnlockDate (API-PHOTO-014, GAT-024)', () => {
  it('makes Day N = start + N-1 calendar days', () => {
    expect(getMilestoneUnlockDate(START, 30)).toBe(addDays(START, 29));
    expect(getMilestoneUnlockDate(START, 60)).toBe(addDays(START, 59));
    expect(getMilestoneUnlockDate(START, 90)).toBe(addDays(START, 89));
  });

  it('crosses month, year and leap-day boundaries', () => {
    expect(getMilestoneUnlockDate('2026-01-05', 30)).toBe('2026-02-03');
    expect(getMilestoneUnlockDate('2026-12-20', 30)).toBe('2027-01-18');
    expect(getMilestoneUnlockDate('2024-02-05', 30)).toBe('2024-03-05');
    expect(getMilestoneUnlockDate('2025-02-05', 30)).toBe('2025-03-06');
  });

  it('is unaffected by a DST change inside the window', () => {
    // 2026-03-29 is the European DST switch; the count must still be exact calendar days.
    expect(getMilestoneUnlockDate('2026-03-01', 30)).toBe('2026-03-30');
    expect(getMilestoneUnlockDate('2026-10-20', 60)).toBe('2026-12-18');
  });

  it('rejects a day that is not a milestone', () => {
    expect(() => getMilestoneUnlockDate(START, 45 as never)).toThrow();
  });
});

describe('getUnlockMilestoneForDay (API-PHOTO-015, GAT-022)', () => {
  it.each([
    [-10, 30],
    [0, 30],
    [1, 30],
    [5, 30],
    [29, 30],
    [30, 30],
    [31, 60],
    [59, 60],
    [60, 60],
    [61, 90],
    [89, 90],
    [90, 90],
  ])('maps Day %i to milestone %i', (day, expected) => {
    expect(getUnlockMilestoneForDay(day)).toBe(expected);
  });

  it('never locks a photo taken after Day 90', () => {
    expect(getUnlockMilestoneForDay(91)).toBeNull();
    expect(getUnlockMilestoneForDay(200)).toBeNull();
  });
});

describe('isMilestoneUnlocked (API-PHOTO-016)', () => {
  it('is locked the day before the unlock date and unlocked on it', () => {
    const unlockDate = getMilestoneUnlockDate(START, 30);
    expect(
      isMilestoneUnlocked({
        startDate: START,
        today: addDays(unlockDate, -1),
        day: 30,
        earlyUnlockedDays: [],
      }),
    ).toBe(false);
    expect(
      isMilestoneUnlocked({ startDate: START, today: unlockDate, day: 30, earlyUnlockedDays: [] }),
    ).toBe(true);
    expect(
      isMilestoneUnlocked({
        startDate: START,
        today: addDays(unlockDate, 10),
        day: 30,
        earlyUnlockedDays: [],
      }),
    ).toBe(true);
  });

  it('is unlocked by an early unlock even before the date', () => {
    expect(
      isMilestoneUnlocked({
        startDate: START,
        today: addDays(START, 2),
        day: 30,
        earlyUnlockedDays: [30],
      }),
    ).toBe(true);
  });

  it('does not let an early unlock of Day 30 unlock Day 60', () => {
    expect(
      isMilestoneUnlocked({
        startDate: START,
        today: addDays(START, 2),
        day: 60,
        earlyUnlockedDays: [30],
      }),
    ).toBe(false);
  });
});

describe('getNextPendingMilestone (API-PHOTO-017)', () => {
  it('is Day 30 before anything is unlocked', () => {
    expect(
      getNextPendingMilestone({ startDate: START, today: addDays(START, 1), earlyUnlockedDays: [] }),
    ).toBe(30);
  });

  it('moves on as each milestone unlocks, by date or early', () => {
    const day30 = getMilestoneUnlockDate(START, 30);
    expect(
      getNextPendingMilestone({ startDate: START, today: addDays(day30, -1), earlyUnlockedDays: [] }),
    ).toBe(30);
    expect(
      getNextPendingMilestone({ startDate: START, today: day30, earlyUnlockedDays: [] }),
    ).toBe(60);
    expect(
      getNextPendingMilestone({ startDate: START, today: day30, earlyUnlockedDays: [60] }),
    ).toBe(90);
    expect(
      getNextPendingMilestone({
        startDate: START,
        today: addDays(START, 1),
        earlyUnlockedDays: [30, 60],
      }),
    ).toBe(90);
  });

  it('is null once all three are unlocked', () => {
    expect(
      getNextPendingMilestone({
        startDate: START,
        today: getMilestoneUnlockDate(START, 90),
        earlyUnlockedDays: [],
      }),
    ).toBeNull();
  });
});