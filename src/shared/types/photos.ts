/**
 * INTEGRATION CONTRACT: TYPE-PHOTO-001 .. TYPE-PHOTO-009
 * Purpose: 90-day "Journeys", locked progress photos and derived milestone/comparison views.
 * Canonical definition: SHARED_CONTRACT.md §3.8
 * Consumers: photos (A5), training (A2), shell (A7)
 * Contract status: APPROVED
 */
import type { Id, IsoDateTime, LocalDate } from './common';

export type JourneyStatus = 'active' | 'completed';

export interface Journey {
  id: Id;
  number: number;
  startDate: LocalDate;
  status: JourneyStatus;
  completedOn: LocalDate | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export type MilestoneDay = 30 | 60 | 90;
export type ProgressPhotoCategory = 'front' | 'side' | 'back' | 'other';

export interface ProgressPhotoView {
  id: Id;
  journeyId: Id;
  capturedAt: IsoDateTime;
  capturedOn: LocalDate;
  dayNumber: number;
  sessionId: Id | null;
  category: ProgressPhotoCategory | null;
  unlockMilestone: MilestoneDay | null; // null => never locked (taken after Day 90)
  visible: boolean;
  imageUri: string | null; // MUST be null whenever visible === false (no path/thumbnail leaks)
}

export interface MilestoneState {
  journeyId: Id;
  day: MilestoneDay;
  unlockDate: LocalDate;
  unlocked: boolean;
  unlockedEarly: boolean;
  isNextPending: boolean;
  lockedPhotoCount: number;
}

export interface ComparisonPair {
  milestone: MilestoneDay;
  baseline: ProgressPhotoView | null;
  target: ProgressPhotoView | null;
  available: boolean; // milestone unlocked AND baseline AND target present
}

export interface TimelineSlot {
  day: number;
  photo: ProgressPhotoView | null; // exact dayNumber match, visible only
}

export interface AddProgressPhotoInput {
  tempImageUri: string;
  sessionId?: Id;
  category?: ProgressPhotoCategory;
  capturedAt?: IsoDateTime;
}