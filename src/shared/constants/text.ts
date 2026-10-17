/**
 * INTEGRATION CONTRACT: CONST-TEXT-001 .. CONST-TEXT-010
 * Purpose: the ONLY fixed user-facing safety/disclaimer/legal text in the app. Values are verbatim
 *          from SHARED_CONTRACT.md §6. Never reword, never generate similar text elsewhere.
 * Consumers: 001 A7 · 002/003 A1 safety · 004 A3,A7 · 005 A5,A7 · 006 A2,A6 · 007 A4 · 008 A2 ·
 *            009 A1 safety UI, A6 · 010 A1 activityCalories
 * Contract status: APPROVED
 */
import type { SymptomFlag } from '../types/safety';
import type { ExerciseIntensity } from '../types/training';

export const HEALTH_DISCLAIMER_TEXT =
  'This app is a personal tracking tool. It is not a medical device and does not replace your ' +
  'physiotherapist, surgeon or doctor. It only records and reminds you about exercises you enter ' +
  'and have been cleared to do. It does not diagnose, prescribe rehabilitation, or change your plan.';

export const SAFETY_ADVICE_TITLE = 'Please pause and check in with your clinician';

export const SAFETY_ADVICE_MESSAGE =
  'You reported a symptom that may need attention. Stop exercising for now and contact your ' +
  'clinician (for example your physiotherapist or surgeon) to discuss it. If symptoms are severe ' +
  'or come on suddenly, seek urgent medical care. This app records what you tell it; it cannot ' +
  'assess your symptoms or change your plan.';

export const ESTIMATE_DISCLAIMER_TEXT =
  'Photo-based calorie and protein values are rough estimates. Portion size and hidden ingredients ' +
  '(oil, ghee, sugar, coconut) can change them a lot.';

export const LOCK_NOTE_TEXT =
  'Progress-photo locking is a motivation feature, not encryption. Photos are stored privately in ' +
  'this app, but they can still be reached through device backups, screenshots, or by anyone with ' +
  'access to your phone.';

export const WORKOUT_KCAL_LABEL = 'Estimated workout calories (rough)';

export const BACKUP_PRIVACY_WARNING =
  'Backups are NOT encrypted. They contain your health records and all photos, including locked ' +
  'progress photos. Save them only somewhere you trust. If you lose this phone or uninstall the ' +
  'app, data that was never backed up is lost.';

export const BATTERY_OPTIMISATION_NOTE =
  'Android battery optimisation or restricted "Alarms & reminders" settings can delay or block ' +
  'reminders. If they arrive late, allow this app to run in the background and to schedule alarms ' +
  'in Android Settings.';

export const SYMPTOM_FLAG_LABELS: Record<SymptomFlag, string> = {
  sharp_or_increasing_pain: 'Sharp or increasing pain',
  new_swelling: 'New or increased swelling',
  giving_way: 'Knee giving way',
  locking_or_catching: 'Locking or catching',
  numbness_or_tingling: 'Numbness or tingling',
  other_new_symptom: 'Other new symptom',
};

/** Rough planning constants, NOT a published table; never claim a source. */
export const INTENSITY_MET: Record<ExerciseIntensity, number> = {
  light: 2.5,
  moderate: 3.5,
  vigorous: 5.0,
};