/**
 * INTEGRATION CONTRACT: internal (A5 photos)
 * Purpose: the pure builders that turn stored rows into views. The lock is enforced HERE, in the
 *          data layer's view builder: a locked photo is returned with `imageUri: null`, so no screen
 *          can leak a path or a thumbnail even by accident (SEC-08).
 * Canonical definition: SHARED_CONTRACT.md §10, ERROR_HANDLING_AND_SECURITY SEC-08
 * Consumers: photoRepository.ts
 * Contract status: APPROVED (internal symbol, no registry ID)
 */
import {
  getDayNumber,
  getMilestoneUnlockDate,
  getNextPendingMilestone,
  getUnlockMilestoneForDay,
  isMilestoneUnlocked,
  MILESTONE_DAYS,
} from './milestones';
import type { LocalDate } from '@/shared/types/common';
import type {
  ComparisonPair,
  Journey,
  MilestoneDay,
  MilestoneState,
  ProgressPhotoView,
  TimelineSlot,
} from '@/shared/types/photos';

export interface ProgressPhotoRow {
  id: string;
  journeyId: string;
  imagePath: string;
  capturedAt: string;
  capturedOn: LocalDate;
  sessionId: string | null;
  category: ProgressPhotoView['category'];
}

export interface JourneyLockContext {
  journey: Journey;
  today: LocalDate;
  earlyUnlockedDays: MilestoneDay[];
}

export function isVisible(context: JourneyLockContext, dayNumber: number): boolean {
  const milestone = getUnlockMilestoneForDay(dayNumber);
  if (milestone === null) {
    return true;
  }
  return isMilestoneUnlocked({
    startDate: context.journey.startDate,
    today: context.today,
    day: milestone,
    earlyUnlockedDays: context.earlyUnlockedDays,
  });
}

/**
 * Builds the views. `resolveUri` is only ever called for a VISIBLE photo, so a locked photo's path
 * never even leaves this function.
 */
export function buildPhotoViews(
  rows: ProgressPhotoRow[],
  context: JourneyLockContext,
  resolveUri: (relativePath: string) => string,
): ProgressPhotoView[] {
  return rows
    .map((row): ProgressPhotoView => {
      const dayNumber = getDayNumber(context.journey.startDate, row.capturedOn);
      const unlockMilestone = getUnlockMilestoneForDay(dayNumber);
      const visible =
        unlockMilestone === null ||
        isMilestoneUnlocked({
          startDate: context.journey.startDate,
          today: context.today,
          day: unlockMilestone,
          earlyUnlockedDays: context.earlyUnlockedDays,
        });

      return {
        id: row.id,
        journeyId: row.journeyId,
        capturedAt: row.capturedAt,
        capturedOn: row.capturedOn,
        dayNumber,
        sessionId: row.sessionId,
        category: row.category,
        unlockMilestone,
        visible,
        imageUri: visible ? resolveUri(row.imagePath) : null,
      };
    })
    .sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt));
}

export function buildMilestoneStates(
  views: ProgressPhotoView[],
  context: JourneyLockContext,
): MilestoneState[] {
  const next = getNextPendingMilestone({
    startDate: context.journey.startDate,
    today: context.today,
    earlyUnlockedDays: context.earlyUnlockedDays,
  });

  return MILESTONE_DAYS.map((day) => {
    const unlocked = isMilestoneUnlocked({
      startDate: context.journey.startDate,
      today: context.today,
      day,
      earlyUnlockedDays: context.earlyUnlockedDays,
    });
    const lockedPhotoCount = views.filter(
      (view) => view.unlockMilestone === day && !view.visible,
    ).length;

    return {
      journeyId: context.journey.id,
      day,
      unlockDate: getMilestoneUnlockDate(context.journey.startDate, day),
      unlocked,
      unlockedEarly: unlocked && context.earlyUnlockedDays.includes(day),
      isNextPending: next === day,
      lockedPhotoCount,
    };
  });
}

/**
 * CONTRACT §10: baseline = the earliest VISIBLE photo of the journey. Target = the photo with the
 * greatest day number in (previous milestone, m]; previous of Day 30 is 0. The target is null when it
 * would be the same photo as the baseline.
 */
export function buildComparisonPairs(
  views: ProgressPhotoView[],
  context: JourneyLockContext,
): ComparisonPair[] {
  const visible = views
    .filter((view) => view.visible && view.imageUri !== null)
    .sort((a, b) => a.dayNumber - b.dayNumber || Date.parse(a.capturedAt) - Date.parse(b.capturedAt));

  const baseline = visible.length > 0 ? (visible[0] as ProgressPhotoView) : null;

  return MILESTONE_DAYS.map((milestone) => {
    const previous = milestone === 30 ? 0 : milestone - 30;
    const candidates = visible.filter(
      (view) => view.dayNumber > previous && view.dayNumber <= milestone,
    );
    const target =
      candidates.length === 0
        ? null
        : (candidates[candidates.length - 1] as ProgressPhotoView);
    const resolvedTarget = target && baseline && target.id === baseline.id ? null : target;

    return {
      milestone,
      baseline,
      target: resolvedTarget,
      available: baseline !== null && resolvedTarget !== null,
    };
  });
}

/** CONTRACT §10: exact day-number matches only; a locked photo at that day shows as empty. */
export function buildTimelineSlots(
  views: ProgressPhotoView[],
  days: readonly number[],
): TimelineSlot[] {
  const byDay = new Map<number, ProgressPhotoView>();
  for (const view of views) {
    if (view.visible && view.imageUri !== null) {
      byDay.set(view.dayNumber, view);
    }
  }
  return days.map((day) => ({ day, photo: byDay.get(day) ?? null }));
}