/**
 * INTEGRATION CONTRACT: TYPE-SET-004 .. TYPE-SET-008
 * Purpose: all app settings. Stored as one JSON row (`settings`, key 'app'); never holds secrets.
 * Canonical definition: SHARED_CONTRACT.md §3.3
 * Consumers: every module (via getSettings/useSettings), reminders (A2), nutrition-ai (A4), shell (A7)
 * Contract status: APPROVED
 */
import type { Id, IsoDateTime, LocalTime } from './common';

export type AiProviderId = 'groq' | 'gemini';

export interface MealReminderSetting {
  enabled: boolean;
  timeLocal: LocalTime;
}

export interface RemindersSettings {
  exercise: { enabled: boolean; timeLocal: LocalTime };
  meals: Record<Id, MealReminderSetting>; // key = MealCategory.id; missing key = disabled
  endOfDay: { enabled: boolean; timeLocal: LocalTime };
}

export interface AiSettings {
  externalAnalysisEnabled: boolean; // global opt-in, default false
  providerId: AiProviderId | null; // default null
  consentGrantedAt: IsoDateTime | null;
  consentProviderId: AiProviderId | null;
  consentDisclosureVersion: number | null;
  modelOverride: string | null; // null = provider default model
}

export interface AppSettings {
  display: { showCalorieEstimates: boolean };
  safety: { painAlertLevel: number | null }; // integer 0..10 or null (user-chosen, never app-chosen)
  reminders: RemindersSettings;
  nutrition: { targetCaloriesKcal: number | null; targetProteinGrams: number | null };
  ai: AiSettings;
}