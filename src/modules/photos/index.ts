/**
 * INTEGRATION CONTRACT: module index for `@/modules/photos`
 * Purpose: the ONLY public surface of the photos module.
 * Consumers: src/app/** and src/shell/** (A7); training (A2) for CMP-PHOTO-007 only
 * Contract status: APPROVED
 */

// CONST-PHOTO-001/002 + API-PHOTO-014..017
export {
  DEFAULT_TIMELINE_DAYS,
  getMilestoneUnlockDate,
  getNextPendingMilestone,
  getUnlockMilestoneForDay,
  isMilestoneUnlocked,
  MILESTONE_DAYS,
} from './domain/milestones';

// API-PHOTO-001..005
export {
  createFirstJourney,
  getActiveJourney,
  listJourneys,
  startNextJourney,
  updateJourneyStartDate,
} from './data/journeyRepository';

// LOCAL-WORKAROUND (A5): the milestone card needs the early-unlock list to show the right
// next-pending milestone. Read-only; it does not let a caller unlock anything.
export { loadEarlyUnlockedDays } from './data/journeyRepository';

// API-PHOTO-006..010, 012, 013
export {
  addProgressPhoto,
  deleteProgressPhoto,
  getComparisonPairs,
  getMilestoneStates,
  getTimelineSlots,
  listProgressPhotos,
  unlockMilestoneEarly,
} from './data/photoRepository';

// API-PHOTO-011
export { exportProgressPhoto } from './services/photoExport';

// HOOK-PHOTO-001
export { useActiveJourney } from './hooks/useActiveJourney';

// CMP-PHOTO-001..008
export { PhotosHomeScreen } from './screens/PhotosHomeScreen';
export { ProgressPhotoCaptureScreen } from './screens/ProgressPhotoCaptureScreen';
export { PhotoComparisonScreen } from './screens/PhotoComparisonScreen';
export { PhotoTimelineScreen } from './screens/PhotoTimelineScreen';
export { JourneysScreen } from './screens/JourneysScreen';
export { TodayMilestoneCard } from './components/TodayMilestoneCard';
export { ProgressPhotoPromptCard } from './components/ProgressPhotoPromptCard';
export { JourneySettingsSection } from './components/JourneySettingsSection';