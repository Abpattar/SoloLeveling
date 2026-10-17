/**
 * INTEGRATION CONTRACT: CONST-SET-001, CONST-SET-002
 * Purpose: factory defaults for `AppSettings`, and default meal reminder times.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (CONST-SET-001, CONST-SET-002)
 * Consumers: settingsRepository (A1), onboarding (A7), reminders (A2)
 * Contract status: APPROVED
 */
import type { Id, LocalTime } from '../types/common';
import type { AppSettings } from '../types/settings';

/**
 * INTEGRATION CONTRACT: CONST-SET-001
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md
 * Consumers: settingsRepository (A1), reminders (A2), nutrition-ai (A4), shell (A7)
 * Contract status: APPROVED
 */
export const DEFAULT_APP_SETTINGS: AppSettings = {
  display: { showCalorieEstimates: true },
  safety: { painAlertLevel: null },
  reminders: {
    exercise: { enabled: false, timeLocal: '08:00' },
    meals: {
      'meal-breakfast': { enabled: false, timeLocal: '08:30' },
      'meal-lunch': { enabled: false, timeLocal: '13:00' },
      'meal-snacks': { enabled: false, timeLocal: '16:30' },
      'meal-dinner': { enabled: false, timeLocal: '20:00' },
    },
    endOfDay: { enabled: false, timeLocal: '21:00' },
  },
  nutrition: { targetCaloriesKcal: null, targetProteinGrams: null },
  ai: {
    externalAnalysisEnabled: false,
    providerId: null,
    consentGrantedAt: null,
    consentProviderId: null,
    consentDisclosureVersion: null,
    modelOverride: null,
  },
};

/** INTEGRATION CONTRACT: CONST-SET-002 · Consumers: reminders (A2) · Contract status: APPROVED */
export const DEFAULT_MEAL_REMINDER_TIMES: Record<Id, LocalTime> = {
  'meal-breakfast': '08:30',
  'meal-lunch': '13:00',
  'meal-snacks': '16:30',
  'meal-dinner': '20:00',
};