/**
 * INTEGRATION CONTRACT: CMP-SHELL-003
 * Purpose: the Settings screen. It only composes sections, in the exact order SHARED_CONTRACT §5
 *          fixes. It owns no state and no business logic.
 * Canonical definition: SHARED_CONTRACT.md §5, SHARED_SYMBOL_REGISTRY.md (CMP-SHELL-003)
 * Consumers: src/app/settings.tsx
 * Contract status: APPROVED
 */
import React from 'react';
// CONTRACT: CMP-UI-001 (A1) - screen chrome
import { Screen } from '@/shared/ui/Screen';
// CMP-SHELL-003 section 1 (A7 self) - profile and units
import { ProfileSection } from './sections/ProfileSection';
// CONTRACT: CMP-PHOTO-009 (A5) - journeys
import { JourneySettingsSection } from '@/modules/photos';
// CONTRACT: CMP-REM-001 (A2) - reminders
import { ReminderSettingsSection } from '@/modules/reminders';
// CONTRACT: CMP-FOOD-006 (A3) - nutrition targets
import { NutritionTargetsSettingsSection } from '@/modules/food';
// CONTRACT: CMP-AI-001 (A4) - photo analysis consent
import { AnalysisSettingsSection } from '@/modules/nutrition-ai';
// CMP-SHELL-003 section 6 (A7 self) - display toggle
import { DisplaySection } from './sections/DisplaySection';
// CMP-SHELL-003 section 7 (A7 self) - symptom alert level
import { SafetySection } from './sections/SafetySection';
// CONTRACT: CMP-BKP-002 (A4) - backup and restore
import { BackupSettingsSection } from '@/modules/backup';
// CMP-SHELL-003 section 9 (A7 self) - fixed legal text
import { AboutSection } from './sections/AboutSection';

export function SettingsScreen(): React.JSX.Element {
  return (
    <Screen>
      <ProfileSection />
      <JourneySettingsSection />
      <ReminderSettingsSection />
      <NutritionTargetsSettingsSection />
      <AnalysisSettingsSection />
      <DisplaySection />
      <SafetySection />
      <BackupSettingsSection />
      <AboutSection />
    </Screen>
  );
}
