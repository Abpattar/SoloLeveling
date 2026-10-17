# SHARED_CONTRACT.md — Recovery & Fitness App

**Version:** 1.0 · **Date:** 2026-10-11 · **Status:** APPROVED (pending user review of flagged decisions in README_FIRST.md)
**Authority:** This file is authoritative for cross-module interfaces. Function/component signatures live in `SHARED_SYMBOL_REGISTRY.md` (incorporated by reference). On conflict: this contract's TypeScript beats registry prose; both beat agent prompts. A conflict must be reported, never silently resolved.

---

## 1. Fixed technology decisions

| Item | Decision |
|---|---|
| Language | TypeScript, `strict: true`, no `any` in exported signatures |
| Framework | Expo SDK **57** (React Native 0.86, React 19.2), Android-first, development build (`expo-dev-client`). Do NOT use SDK 58 (beta as of 2026-10-11) |
| Node / JDK | Node ≥ 22.13 · JDK 17 · Android SDK Platform 36 |
| Routing | `expo-router` (file-based, routes in `src/app/`) |
| Local data | `expo-sqlite` (ONLY `src/shared/db/**` imports it) |
| Photos | App-private files via `expo-file-system` new `File`/`Directory` API (ONLY `src/shared/files/**` and `src/modules/backup/**` import it) |
| Camera | `expo-camera` (ONLY `src/shared/ui/PhotoCapture.tsx` imports it) |
| Notifications | `expo-notifications` local notifications (ONLY `src/modules/reminders/**` imports it) |
| Secrets | `expo-secure-store` (ONLY `src/shared/platform/secureStorage.ts` imports it) |
| Charts | Hand-written SVG using `react-native-svg` (no chart library) |
| State | React state + SQLite as source of truth. No Redux/Zustand/MobX. Screens reload on focus via `useFocusLoad` and on events via `useAppEvent` |
| Network | Exactly ONE module may use `fetch`: `src/modules/nutrition-ai/**`. No analytics, crash reporters, remote config, or other network code anywhere |
| Backend | None |
| Path alias | `@/*` → `src/*` (tsconfig + jest moduleNameMapper) |
| Min Android | Android 7+ (Expo SDK 57 default) |

Approved dependencies (A1 owns `package.json`; install Expo packages with `npx expo install` so versions match SDK 57):
`expo`, `react`, `react-native`, `expo-router`, `expo-dev-client`, `expo-sqlite`, `expo-camera`, `expo-file-system`, `expo-notifications`, `expo-secure-store`, `expo-image-manipulator`, `expo-sharing`, `expo-crypto`, `expo-keep-awake`, `expo-constants`, `expo-linking`, `expo-status-bar`, `react-native-svg`, `react-native-safe-area-context`, `react-native-screens`, `@react-native-community/datetimepicker`.
Dev: `typescript`, `jest`, `jest-expo`, `@types/jest`, `@testing-library/react-native`, `sql.js`, `@types/sql.js`, `eslint`, `eslint-config-expo`, `prettier`.
`@expo/vector-icons` ships inside `expo` and may be used for tab icons. Single-owner imports: `expo-sharing` only in `src/modules/photos/services/photoExport.ts`; `expo-image-manipulator` only in `src/modules/nutrition-ai/imagePrep.ts`; `expo-keep-awake` only in `src/modules/training/hooks/useSessionRunner.ts`.
**Any other package requires a CHANGE request** (see AGENT_INTEGRATION_PROTOCOL.md §4).

## 2. Global conventions (mandatory)

1. **Time.** Instants are UTC ISO strings (`IsoDateTime`, from `nowIso()`). Calendar days are device-local `LocalDate` (`"YYYY-MM-DD"`) captured at event time and stored beside the instant (`local_date`). Time of day is `LocalTime` (`"HH:mm"`). Date arithmetic is DST-safe (integer Y-M-D via `Date.UTC`). "Day N" = `diffCalendarDays(startDate, date) + 1`; Day 30 = start + 29 days.
2. **IDs.** `newId()` → UUID v4 string. Seeded rows use fixed IDs (`meal-breakfast`, `meal-lunch`, `meal-dinner`, `meal-snacks`).
3. **Units.** Stored as entered with explicit unit (measurements) or canonical metric (`heightCm`, `baselineWeightKg`). Display conversion only via `@/shared/utils/units`.
4. **Booleans** are `INTEGER 0/1` in SQLite, `boolean` in TypeScript. **JSON columns** are `TEXT` holding `JSON.stringify` output; repositories parse/validate defensively (bad JSON → `[]`/`null`, never throw).
5. **Row mapping.** SQL columns are `snake_case`; TypeScript fields are `camelCase`. Each repository maps explicitly; no generic mappers across modules.
6. **Errors.** Repositories/domain functions **throw `AppError`**. I/O services (nutrition estimation, backup/restore, permission requests, photo export) **return `Result<T>`** and never throw for expected failures. UI shows `error.message` (user-safe); never show raw `cause`.
7. **Layering / imports (enforced by OpenCode script).**
   - Any file may import `@/shared/**` (never `@/shared/**/testing/**` from production code).
   - `src/shared/**` must NOT import `@/modules/**`, `@/shell/**`, `@/app/**`.
   - A module may import another module ONLY through `@/modules/<name>` (its `index.ts`) and ONLY along the edges in §2.8. Never import another module's internal files.
   - `src/shell/**` and `src/app/**` may import any module's `index.ts`.
8. **Allowed module edges (acyclic):** `training → photos` · `reminders → training` · `reminders → food` · `food → nutrition-ai` · `progress → training | food | body | journal`. All others: shared only. (`backup`, `photos`, `nutrition-ai`, `body`, `journal` import no modules.)
9. **Events** are the only mechanism for "X happened, others may react" (see §3.12). Emitters and subscribers are fixed in the registry.
10. **Logging.** Only `logger` from `@/shared/utils/logger`. Never log image URIs, base64, API keys, or note text.
11. **Comments.** Every exported cross-module symbol carries an `INTEGRATION CONTRACT: <ID>` block; every cross-module import line is preceded by `// CONTRACT: <ID>` (format in CODING_CONVENTIONS.md).
12. **Medical boundary.** No code may generate diagnoses, rehab stages, return-to-sport judgments, exercise progression, diet prescriptions, or "net calorie" figures. Workout calories are never added to or subtracted from intake.

## 3. Canonical shared type files (verbatim — Agent 01 copies these exactly)

### 3.1 `src/shared/types/common.ts`
```ts
import type { AppError } from '../errors/AppError';

export type Id = string;
export type IsoDateTime = string; // UTC instant, e.g. "2026-10-12T04:30:00.000Z"
export type LocalDate = string;   // device-local day "YYYY-MM-DD"
export type LocalTime = string;   // device-local "HH:mm" (24h)
export type Unsubscribe = () => void;
export type Result<T> = { ok: true; value: T } | { ok: false; error: AppError };
export type DeepPartial<T> = T extends (infer U)[]
  ? U[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;
```

### 3.2 `src/shared/errors/AppError.ts` (signature; Agent 01 implements)
```ts
export type AppErrorCode =
  | 'VALIDATION' | 'NOT_FOUND' | 'CONFLICT' | 'STORAGE' | 'PERMISSION_DENIED'
  | 'OFFLINE' | 'NETWORK' | 'CONSENT_REQUIRED' | 'NOT_CONFIGURED' | 'PROVIDER_ERROR'
  | 'RATE_LIMITED' | 'PARSE_ERROR' | 'UNSUPPORTED' | 'LOCKED' | 'CANCELLED' | 'UNKNOWN';

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly cause?: unknown;
  readonly details?: Record<string, string | number | boolean | null>;
  constructor(code: AppErrorCode, message: string, options?: { cause?: unknown; details?: Record<string, string | number | boolean | null> });
}
```

### 3.3 `src/shared/types/profile.ts` and `src/shared/types/settings.ts`
```ts
// profile.ts
import type { IsoDateTime } from './common';
export type UnitSystem = 'metric' | 'imperial';
export interface Profile {
  heightCm: number | null;
  unitSystem: UnitSystem;
  baselineWeightKg: number | null;
  onboardingCompleted: boolean;
  disclaimerAcknowledgedAt: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}
export interface ProfileUpdate {
  heightCm?: number | null;
  unitSystem?: UnitSystem;
  baselineWeightKg?: number | null;
}
```
```ts
// settings.ts
import type { Id, IsoDateTime, LocalTime } from './common';
export type AiProviderId = 'groq' | 'gemini';
export interface MealReminderSetting { enabled: boolean; timeLocal: LocalTime }
export interface RemindersSettings {
  exercise: { enabled: boolean; timeLocal: LocalTime };
  meals: Record<Id, MealReminderSetting>; // key = MealCategory.id; missing key = disabled
  endOfDay: { enabled: boolean; timeLocal: LocalTime };
}
export interface AiSettings {
  externalAnalysisEnabled: boolean;          // global opt-in, default false
  providerId: AiProviderId | null;           // default null
  consentGrantedAt: IsoDateTime | null;
  consentProviderId: AiProviderId | null;
  consentDisclosureVersion: number | null;
  modelOverride: string | null;              // null = provider default model
}
export interface AppSettings {
  display: { showCalorieEstimates: boolean };
  safety: { painAlertLevel: number | null }; // integer 0..10 or null (user-chosen, never app-chosen)
  reminders: RemindersSettings;
  nutrition: { targetCaloriesKcal: number | null; targetProteinGrams: number | null };
  ai: AiSettings;
}
```

### 3.4 `src/shared/types/safety.ts`
```ts
export type SymptomFlag =
  | 'sharp_or_increasing_pain' | 'new_swelling' | 'giving_way'
  | 'locking_or_catching' | 'numbness_or_tingling' | 'other_new_symptom';
export interface SymptomReport { flags: SymptomFlag[]; painScore: number | null } // painScore 0..10
export interface SafetyAdvice {
  level: 'stop_and_contact_clinician';
  title: string;
  message: string;
  reasons: string[]; // human labels of triggering flags / pain level
}
```

### 3.5 `src/shared/types/training.ts`
```ts
import type { Id, IsoDateTime, LocalDate } from './common';
import type { SymptomFlag } from './safety';

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7; // ISO: 1=Mon … 7=Sun
export type ExerciseStatus = 'active' | 'paused';
export type ExerciseIntensity = 'light' | 'moderate' | 'vigorous';
export interface Exercise {
  id: Id;
  name: string;
  instructions: string | null;
  sets: number;                       // >= 1
  reps: number | null;                // at least one of reps / durationSeconds is non-null
  durationSeconds: number | null;
  restSeconds: number;                // >= 0
  scheduleDays: Weekday[];
  clinicianNotes: string | null;
  intensity: ExerciseIntensity | null;
  status: ExerciseStatus;
  sortOrder: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}
export interface ExerciseInput {
  name: string;
  instructions?: string | null;
  sets: number;
  reps?: number | null;
  durationSeconds?: number | null;
  restSeconds?: number;
  scheduleDays: Weekday[];
  clinicianNotes?: string | null;
  intensity?: ExerciseIntensity | null;
  status?: ExerciseStatus;
}
export type SessionStatus = 'completed' | 'stopped';
export type SessionExerciseStatus = 'completed' | 'partial' | 'skipped';
export interface SessionExerciseResult {
  id: Id;
  sessionId: Id;
  exerciseId: Id | null;              // null if the exercise was later deleted
  exerciseName: string;               // snapshot
  plannedSets: number;
  plannedReps: number | null;
  plannedDurationSeconds: number | null;
  completedSets: number;
  completedReps: number | null;       // total reps across sets, null for duration-only
  activeSeconds: number;              // time spent working, excluding rest
  status: SessionExerciseStatus;
  intensity: ExerciseIntensity | null; // snapshot
  sortOrder: number;
}
export interface Session {
  id: Id;
  startedAt: IsoDateTime;
  endedAt: IsoDateTime | null;
  localDate: LocalDate;
  status: SessionStatus;
  totalDurationSeconds: number;
  effortRating: number | null;        // 1..10
  notes: string | null;
  painScore: number | null;           // 0..10
  symptomFlags: SymptomFlag[];
  estimatedKcal: number | null;       // rough workout estimate; never combined with intake
  results: SessionExerciseResult[];
  createdAt: IsoDateTime;
}
export interface SaveSessionInput {
  startedAt: IsoDateTime;
  endedAt: IsoDateTime;
  status: SessionStatus;
  totalDurationSeconds: number;
  results: Array<Omit<SessionExerciseResult, 'id' | 'sessionId'>>;
}
export interface SessionDayStatus {
  localDate: LocalDate;
  scheduledExerciseCount: number;     // active exercises scheduled for that weekday
  completedSessionCount: number;
  stoppedSessionCount: number;
}
```

### 3.6 `src/shared/types/food.ts`
```ts
import type { Id, IsoDateTime, LocalDate } from './common';
import type { AiProviderId } from './settings';
import type { ClarificationQuestion } from './nutritionAi';

export interface MealCategory {
  id: Id; name: string; isDefault: boolean; sortOrder: number; archivedAt: IsoDateTime | null;
}
export type NutritionSource = 'none' | 'ai_estimate' | 'confirmed' | 'manual' | 'unknown';
export type Confidence = 'unknown' | 'low' | 'medium' | 'high';
export type AnalysisStatus =
  | 'not_requested' | 'pending' | 'in_progress' | 'succeeded' | 'failed' | 'skipped_by_user';
export interface NutritionValues {
  caloriesKcal: number | null; proteinGrams: number | null;
  carbsGrams: number | null;   fatGrams: number | null;
}
export interface NutritionTotals {
  caloriesKcal: number; proteinGrams: number;
  carbsGrams: number | null; fatGrams: number | null; // null when no entry supplied a value
}
export interface FoodItem {
  name: string; portionText: string | null; caloriesKcal: number | null; proteinGrams: number | null;
}
export interface FoodEntry {
  id: Id;
  mealCategoryId: Id;
  imagePath: string;                  // RELATIVE path under the private photo root, e.g. "food/<id>.jpg"
  capturedAt: IsoDateTime;
  localDate: LocalDate;
  note: string | null;
  description: string | null;         // detected/confirmed foods in words
  foods: FoodItem[];
  portionText: string | null;
  nutrition: NutritionValues;
  nutritionSource: NutritionSource;   // 'ai_estimate' = unconfirmed AI; 'confirmed' = user-approved (maybe edited) AI result
  confidence: Confidence;
  analysisStatus: AnalysisStatus;
  analysisOptOut: boolean;            // per-photo "do not send"
  analysisProvider: AiProviderId | null;
  analysisError: string | null;
  analyzedAt: IsoDateTime | null;
  pendingClarification: ClarificationQuestion | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}
export interface CreateFoodEntryInput {
  mealCategoryId: Id;
  tempImageUri: string;               // camera output; copied into private storage, temp deleted
  capturedAt?: IsoDateTime;           // default now; must not be in the future
  note?: string | null;
  analysisOptOut?: boolean;
}
export interface FoodEntryDetailsPatch {
  mealCategoryId?: Id; note?: string | null; description?: string | null;
  portionText?: string | null; foods?: FoodItem[]; capturedAt?: IsoDateTime;
}
export interface DailyNutritionTotals {
  localDate: LocalDate;
  total: NutritionTotals;             // sums ai_estimate + confirmed + manual entries only
  bySource: Record<'ai_estimate' | 'confirmed' | 'manual', NutritionTotals>;
  mealSubtotals: Array<{ mealCategoryId: Id; entryCount: number; total: NutritionTotals }>;
  entryCount: number;
  entriesWithoutValues: number;       // none/unknown source or null calories
}
```

### 3.7 `src/shared/types/nutritionAi.ts`
```ts
import type { Confidence, NutritionValues } from './food';
import type { AiProviderId } from './settings';

export interface ClarificationQuestion {
  question: string; options: string[]; affects: 'portion' | 'ingredient';
}
export interface EstimatedFoodItem {
  name: string; portionText: string | null; caloriesKcal: number | null; proteinGrams: number | null;
}
export interface NutritionEstimateRequest {
  imageUri: string;                   // MUST be a private FOOD photo (under photo root "food/"); progress photos are rejected
  mealCategoryName?: string;
  userNote?: string;
  clarification?: { question: string; answer: string };
  signal?: AbortSignal;
}
export interface NutritionEstimate {
  description: string;
  items: EstimatedFoodItem[];
  portionText: string | null;
  nutrition: NutritionValues;
  confidence: Confidence;
  clarification: ClarificationQuestion | null;
  providerId: AiProviderId;
  modelId: string;
  notFood: boolean;                   // true => items empty, nutrition all null
}
export type AnalysisAvailability =
  | { state: 'ready'; providerId: AiProviderId }
  | { state: 'disabled' | 'no_provider' | 'no_consent' | 'no_api_key' };
export interface AiProviderInfo {
  id: AiProviderId; displayName: string; freeTierSummary: string; dataHandlingSummary: string;
  disclosureVersion: number; docsUrl: string; apiKeyUrl: string; defaultModelId: string; verifiedOn: string;
}
```

### 3.8 `src/shared/types/photos.ts`
```ts
import type { Id, IsoDateTime, LocalDate } from './common';

export type JourneyStatus = 'active' | 'completed';
export interface Journey {
  id: Id; number: number; startDate: LocalDate; status: JourneyStatus;
  completedOn: LocalDate | null; createdAt: IsoDateTime; updatedAt: IsoDateTime;
}
export type MilestoneDay = 30 | 60 | 90;
export type ProgressPhotoCategory = 'front' | 'side' | 'back' | 'other';
export interface ProgressPhotoView {
  id: Id; journeyId: Id; capturedAt: IsoDateTime; capturedOn: LocalDate; dayNumber: number;
  sessionId: Id | null; category: ProgressPhotoCategory | null;
  unlockMilestone: MilestoneDay | null; // null => never locked (taken after Day 90)
  visible: boolean;
  imageUri: string | null;            // MUST be null whenever visible === false (no path/thumbnail leaks)
}
export interface MilestoneState {
  journeyId: Id; day: MilestoneDay; unlockDate: LocalDate; unlocked: boolean;
  unlockedEarly: boolean; isNextPending: boolean; lockedPhotoCount: number;
}
export interface ComparisonPair {
  milestone: MilestoneDay; baseline: ProgressPhotoView | null; target: ProgressPhotoView | null;
  available: boolean;                 // milestone unlocked AND baseline AND target present
}
export interface TimelineSlot { day: number; photo: ProgressPhotoView | null } // exact dayNumber match, visible only
export interface AddProgressPhotoInput {
  tempImageUri: string; sessionId?: Id; category?: ProgressPhotoCategory; capturedAt?: IsoDateTime;
}
```

### 3.9 `src/shared/types/body.ts`, `journal.ts`, `summary.ts`, `backup.ts`
```ts
// body.ts
import type { Id, IsoDateTime, LocalDate } from './common';
export type MeasurementType = 'weight' | 'waist' | 'thigh' | 'custom';
export interface Measurement {
  id: Id; type: MeasurementType; customLabel: string | null; value: number; unit: string; // 'kg'|'lb'|'cm'|'in'|custom text
  measuredAt: IsoDateTime; localDate: LocalDate; note: string | null; createdAt: IsoDateTime;
}
export interface MeasurementInput {
  type: MeasurementType; customLabel?: string | null; value: number; unit: string;
  measuredAt?: IsoDateTime; note?: string | null;
}
export interface WeightPoint { localDate: LocalDate; valueKg: number }
```
```ts
// journal.ts
import type { Id, IsoDateTime, LocalDate } from './common';
import type { SymptomFlag } from './safety';
export type SwellingLevel = 'none' | 'mild' | 'moderate' | 'significant';
export interface JournalEntry {
  id: Id; localDate: LocalDate; recordedAt: IsoDateTime; painScore: number | null; stiffnessScore: number | null;
  swellingLevel: SwellingLevel | null; symptomFlags: SymptomFlag[]; notes: string | null;
  createdAt: IsoDateTime; updatedAt: IsoDateTime;
}
export interface JournalEntryInput {
  localDate?: LocalDate; painScore?: number | null; stiffnessScore?: number | null;
  swellingLevel?: SwellingLevel | null; symptomFlags?: SymptomFlag[]; notes?: string | null;
}
```
```ts
// summary.ts
import type { LocalDate } from './common';
import type { DailyNutritionTotals } from './food';
import type { Session } from './training';
import type { Measurement } from './body';
import type { JournalEntry } from './journal';
export interface DailySummary {
  localDate: LocalDate;
  nutrition: DailyNutritionTotals;
  targets: { caloriesKcal: number | null; proteinGrams: number | null };
  scheduledExerciseCount: number;
  sessions: Session[];
  estimatedWorkoutKcal: number | null; // sum of completed sessions' estimatedKcal; NEVER combined with intake
  weightKg: number | null;             // latest weight measurement on that date, converted to kg
  measurements: Measurement[];
  journalEntries: JournalEntry[];
}
```
```ts
// backup.ts
import type { IsoDateTime } from './common';
export interface BackupManifest {
  formatVersion: 1; appSchemaVersion: number; createdAt: IsoDateTime; appVersion: string;
  tables: Record<string, number>; photoCount: number;
}
export interface BackupExportResult {
  folderName: string; tableRowCounts: Record<string, number>; photoCount: number; totalBytes: number;
}
export interface RestoreResult { restoredTables: Record<string, number>; restoredPhotoCount: number }
export interface BackupProgress { phase: 'database' | 'photos' | 'finalizing'; done: number; total: number }
```

### 3.10 `src/shared/types/events.ts`
```ts
import type { Id, LocalDate } from './common';
import type { SessionStatus } from './training';

export interface AppEventMap {
  'settings.changed': { keys: string[] };                                  // top-level AppSettings keys touched
  'food.entry.saved': { entryId: Id; mealCategoryId: Id; localDate: LocalDate };
  'food.entry.deleted': { entryId: Id; localDate: LocalDate };
  'session.saved': { sessionId: Id; localDate: LocalDate; status: SessionStatus };
  'exercises.changed': Record<string, never>;
  'data.restored': Record<string, never>;
}
export type AppEventName = keyof AppEventMap;
```

### 3.11 `src/shared/db/types.ts`
```ts
export type SqlParam = string | number | null;
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: SqlParam[]): Promise<T[]>;
  queryOne<T = Record<string, unknown>>(sql: string, params?: SqlParam[]): Promise<T | null>;
  execute(sql: string, params?: SqlParam[]): Promise<{ changes: number }>;
  /** `tx` is a Db bound to the open transaction. Calling tx.transaction() nests by simply running fn(tx). Rolls back on throw. */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
}
```

### 3.12 Event emitters / subscribers (fixed)
| Event | Emitted by | Subscribed by |
|---|---|---|
| `settings.changed` | `updateSettings`, `resetAiConsent` (A1) | reminders (A2), `SettingsProvider` (A1) |
| `food.entry.saved` | create/update/analyze/confirm/manual/unknown/scale functions (A3) | reminders (A2) |
| `food.entry.deleted` | `deleteFoodEntry` (A3) | reminders (A2) |
| `session.saved` | `saveSession` (A2) | reminders (A2) |
| `exercises.changed` | create/update/delete/reorder exercise (A2) | reminders (A2) |
| `data.restored` | `restoreBackup` (A4) | reminders (A2), `SettingsProvider` (A1), `useFocusLoad` (A1) |

## 4. Routes and props (fixed; Agent 07 writes route files, modules export the components)

`ROUTES` (symbol CONST-NAV-001, `src/shared/navigation/routes.ts`) must contain exactly these keys (strings unless a function):
`onboarding:'/onboarding'`, `today:'/'`, `exercises:'/exercises'`, `food:'/food'`, `photos:'/photos'`, `progress:'/progress'`, `settings:'/settings'`, `exerciseNew:'/exercise/new'`, `exerciseEdit(exerciseId)→'/exercise/<id>'`, `sessionRun(plannedExerciseIds?: string[])→'/session/run'` (+`?ids=a,b` when provided), `sessionComplete(sessionId)→'/session/complete/<id>'`, `sessionHistory:'/session/history'`, `sessionDetail(sessionId)→'/session/<id>'`, `foodCapture(mealCategoryId?)→'/food/capture'` (+`?mealCategoryId=`), `foodEntry(entryId)→'/food/entry/<id>'`, `mealCategories:'/food/categories'`, `photoCapture(sessionId?)→'/photos/capture'` (+`?sessionId=`), `photoCompare(journeyId, milestoneDay)→'/photos/compare/<journeyId>/<day>'`, `photoTimeline(journeyId)→'/photos/timeline/<journeyId>'`, `journeys:'/photos/journeys'`, `measurements:'/measurements'`, `journal:'/journal'`, `journalEntry(entryIdOrNew)→'/journal/<id|new>'`, `dailySummary(date)→'/summary/<YYYY-MM-DD>'`, `backup:'/backup'`.

| Route file (under `src/app/`) | Renders (import from) | Props |
|---|---|---|
| `_layout.tsx` | `AppProviders`, `SetupGate` (shell); calls `useReminderNotificationRouting()` | — |
| `(tabs)/_layout.tsx` | Tabs: index "Today", exercises, food, photos, progress | — |
| `(tabs)/index.tsx` | `TodayScreen` (`@/shell`) | — |
| `(tabs)/exercises.tsx` | `ExerciseListScreen` (`@/modules/training`) | — |
| `(tabs)/food.tsx` | `FoodLogScreen` (`@/modules/food`) | — |
| `(tabs)/photos.tsx` | `PhotosHomeScreen` (`@/modules/photos`) | — |
| `(tabs)/progress.tsx` | `ProgressScreen` (`@/modules/progress`) | — |
| `onboarding.tsx` | `OnboardingScreen` (`@/shell`) | — |
| `settings.tsx` | `SettingsScreen` (`@/shell`) | — |
| `exercise/new.tsx` | `ExerciseEditorScreen` | `{ exerciseId: null }` |
| `exercise/[exerciseId].tsx` | `ExerciseEditorScreen` | `{ exerciseId: string }` |
| `session/run.tsx` | `SessionRunScreen` | `{ plannedExerciseIds: string[] \| null }` (from `ids` query, comma-split) |
| `session/complete/[sessionId].tsx` | `SessionCompleteScreen` | `{ sessionId: string }` |
| `session/history.tsx` | `SessionHistoryScreen` | — |
| `session/[sessionId].tsx` | `SessionDetailScreen` | `{ sessionId: string }` |
| `food/capture.tsx` | `FoodCaptureScreen` | `{ mealCategoryId: string \| null }` |
| `food/entry/[entryId].tsx` | `FoodEntryScreen` | `{ entryId: string }` |
| `food/categories.tsx` | `MealCategoriesScreen` | — |
| `photos/capture.tsx` | `ProgressPhotoCaptureScreen` | `{ sessionId: string \| null }` |
| `photos/compare/[journeyId]/[milestoneDay].tsx` | `PhotoComparisonScreen` | `{ journeyId: string; milestoneDay: MilestoneDay }` (invalid day → render EmptyState) |
| `photos/timeline/[journeyId].tsx` | `PhotoTimelineScreen` | `{ journeyId: string }` |
| `photos/journeys.tsx` | `JourneysScreen` | — |
| `measurements.tsx` | `MeasurementsScreen` (`@/modules/body`) | — |
| `journal/index.tsx` | `JournalScreen` (`@/modules/journal`) | — |
| `journal/[entryId].tsx` | `JournalEntryScreen` | `{ entryId: string \| null }` (`'new'` → null) |
| `summary/[date].tsx` | `DailySummaryScreen` (`@/modules/progress`) | `{ date: LocalDate }` (invalid → EmptyState) |
| `backup.tsx` | `BackupScreen` (`@/modules/backup`) | — |

Route files are ≤ 15 lines: parse params, render the component. All Stack titles are set in the root `_layout.tsx`.

## 5. Today / Settings composition (shell, Agent 07)
- **TodayScreen** renders, in order: header ("Day N · <date>" from `useActiveJourney`), `TodayExerciseCard` (A2), `TodayFoodCard` (A3), `TodayMilestoneCard` (A5), button to `ROUTES.dailySummary(todayLocal())`, gear button to `ROUTES.settings`.
- **SettingsScreen** renders sections in order: Profile & units (shell) → `JourneySettingsSection` (A5) → `ReminderSettingsSection` (A2) → `NutritionTargetsSettingsSection` (A3) → `AnalysisSettingsSection` (A4) → Display toggle `showCalorieEstimates` (shell) → Symptom alert level (shell; optional integer 0–10, helper text: "Only set this if your clinician gave you a number. The app never chooses one for you.") → `BackupSettingsSection` (A4) → About (shell: `HEALTH_DISCLAIMER_TEXT`, `LOCK_NOTE_TEXT`, `ESTIMATE_DISCLAIMER_TEXT`).
- **OnboardingScreen** steps: (1) show `HEALTH_DISCLAIMER_TEXT`, require "I understand" → `acknowledgeDisclaimer`; (2) height, units, optional baseline weight → `updateProfile`; (3) Day 1 start date (default today, must be ≤ today) → `createFirstJourney(startDate)` (A5) → `completeOnboarding()` → `router.replace(ROUTES.today)`.
- **SetupGate**: while `getProfile().onboardingCompleted === false`, redirect to `ROUTES.onboarding`.
- **Foreground hook** (shell): on app foreground call `processPendingAnalyses()` (A3). (`syncReminders` is handled inside `initializeReminders`.)

## 6. Fixed text constants (verbatim; defined in `src/shared/constants/text.ts`)
```ts
export const HEALTH_DISCLAIMER_TEXT =
  'This app is a personal tracking tool. It is not a medical device and does not replace your physiotherapist, surgeon or doctor. It only records and reminds you about exercises you enter and have been cleared to do. It does not diagnose, prescribe rehabilitation, or change your plan.';
export const SAFETY_ADVICE_TITLE = 'Please pause and check in with your clinician';
export const SAFETY_ADVICE_MESSAGE =
  'You reported a symptom that may need attention. Stop exercising for now and contact your clinician (for example your physiotherapist or surgeon) to discuss it. If symptoms are severe or come on suddenly, seek urgent medical care. This app records what you tell it; it cannot assess your symptoms or change your plan.';
export const ESTIMATE_DISCLAIMER_TEXT =
  'Photo-based calorie and protein values are rough estimates. Portion size and hidden ingredients (oil, ghee, sugar, coconut) can change them a lot.';
export const LOCK_NOTE_TEXT =
  'Progress-photo locking is a motivation feature, not encryption. Photos are stored privately in this app, but they can still be reached through device backups, screenshots, or by anyone with access to your phone.';
export const WORKOUT_KCAL_LABEL = 'Estimated workout calories (rough)';
export const BACKUP_PRIVACY_WARNING =
  'Backups are NOT encrypted. They contain your health records and all photos, including locked progress photos. Save them only somewhere you trust. If you lose this phone or uninstall the app, data that was never backed up is lost.';
export const BATTERY_OPTIMISATION_NOTE =
  'Android battery optimisation or restricted "Alarms & reminders" settings can delay or block reminders. If they arrive late, allow this app to run in the background and to schedule alarms in Android Settings.';
export const SYMPTOM_FLAG_LABELS: Record<import('../types/safety').SymptomFlag, string> = {
  sharp_or_increasing_pain: 'Sharp or increasing pain',
  new_swelling: 'New or increased swelling',
  giving_way: 'Knee giving way',
  locking_or_catching: 'Locking or catching',
  numbness_or_tingling: 'Numbness or tingling',
  other_new_symptom: 'Other new symptom',
};
export const INTENSITY_MET: Record<import('../types/training').ExerciseIntensity, number> = {
  light: 2.5, moderate: 3.5, vigorous: 5.0, // rough planning constants, NOT a published table; never claim a source
};
```
(The mapping of constants to registry IDs is in the registry. The AI disclosure texts live in §7.)

## 7. Nutrition estimation contract (Agent 04 implements, Agent 03 consumes)

**Behavior.** `estimateNutritionFromImage(req)` returns `Result<NutritionEstimate>`:
1. `getAnalysisAvailability()` must be `ready`, else `fail('CONSENT_REQUIRED' | 'NOT_CONFIGURED')`.
2. `req.imageUri` must resolve under the private photo root `food/` directory, else `fail('VALIDATION')` (progress photos can never be sent).
3. Downscale to long edge ≤ 1024 px, JPEG ~0.7, no EXIF, base64 in memory only (never written to disk, never logged).
4. HTTPS request via the one allowed HTTP client (`fetch` with 30 s timeout, honoring `req.signal`). API key from `getSecret` only.
5. Parse model output as JSON per schema below; validate; clamp. Errors map: no connectivity → `OFFLINE`; DNS/timeouts → `NETWORK`; HTTP 429 → `RATE_LIMITED`; other non-2xx → `PROVIDER_ERROR`; bad JSON → `PARSE_ERROR`.

**Model JSON schema (the prompt must demand exactly this):**
```json
{"not_food": false, "description": "string", "portion_text": "string|null",
 "items": [{"name": "string", "portion_text": "string|null", "calories_kcal": 0, "protein_g": 0}],
 "totals": {"calories_kcal": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0},
 "confidence": "low|medium|high|unknown",
 "clarification": {"question": "string", "options": ["string"], "affects": "portion|ingredient"} }
```
Validation: numbers finite and ≥ 0; caps calories ≤ 5000, protein ≤ 300, carbs ≤ 800, fat ≤ 400 (above cap → null and confidence `low`); totals null but items present → sum items; `clarification` kept only if question non-empty and 2–4 options; unknown fields ignored.

**Prompt requirements:** estimate for the whole visible portion; say `unknown`/null when unsure; never claim exactness; include hidden fat (oil, ghee, coconut, sugar) in reasoning; use household units (bowl/katori, cup, piece, ladle, plate, glass, "1 serving"); recognize common Indian and South Indian dishes (e.g., idli, dosa, vada, upma, pongal, sambar, rasam, rice with curry/dal/poriyal/kootu, roti/chapati/paratha, biryani, curd rice, payasam, snacks and chaats) and regional meal servings; ask at most ONE clarification, only when the answer would change calories/protein materially (portion size or paneer/egg/meat/ghee presence); no diet advice, no health claims; reply with JSON only.

**Provider catalog (exact content for `src/modules/nutrition-ai/providers/catalog.ts`; `verifiedOn: '2026-10-11'`):**
```ts
export const AI_PROVIDER_CATALOG: AiProviderInfo[] = [
  {
    id: 'groq',
    displayName: 'Groq (free plan available)',
    freeTierSummary: 'Free plan, no payment card needed. Groq publishes sample limits for its vision model of 30 requests/minute, 1,000 requests/day, 8,000 tokens/minute and 200,000 tokens/day (each image counts about 2,048 input tokens). Limits can change and can be lower for your account.',
    dataHandlingSummary: 'Groq states it does not retain inference inputs or outputs by default, but may temporarily log them for up to 30 days to troubleshoot reliability or investigate abuse; Zero Data Retention can be turned on in your Groq account (Data Controls). Retained data is stored in the United States. Read Groq\'s terms for anything else. Your meal photo is sent to Groq over the internet.',
    disclosureVersion: 1,
    docsUrl: 'https://console.groq.com/docs/your-data',
    apiKeyUrl: 'https://console.groq.com/keys',
    defaultModelId: 'qwen/qwen3.8-27b', // documented as Groq's vision model on 2026-10-11; model IDs change — re-verify at https://console.groq.com/docs/vision
    verifiedOn: '2026-10-11',
  },
  {
    id: 'gemini',
    displayName: 'Google Gemini API (free tier available)',
    freeTierSummary: 'A free tier exists with lower rate limits (see Google AI Studio for your current limits). A paid tier exists; no charge occurs unless you enable billing.',
    dataHandlingSummary: 'On the FREE tier Google states that your prompts, images and responses may be used to improve its products and that human reviewers may read them. The paid tier does not use your content for product improvement. Availability and terms can vary by region. Your meal photo is sent to Google over the internet.',
    disclosureVersion: 1,
    docsUrl: 'https://ai.google.dev/gemini-api/terms',
    apiKeyUrl: 'https://aistudio.google.com/apikey',
    defaultModelId: 'gemini-2.5-flash-lite', // seen listed with a free tier in 2026 sources; NOT re-verified — confirm at https://ai.google.dev/gemini-api/docs/models
    verifiedOn: '2026-10-11',
  },
];
```
Adapters: `groq` uses the OpenAI-compatible endpoint `https://api.groq.com/openai/v1/chat/completions` (`image_url` data URI, JSON mode, reasoning effort set to the lowest available for speed; max 3 images, we send 1). `gemini` uses `generateContent` with inline image data and JSON response mime type (verify current request shape in Google docs). Endpoint hosts are the ONLY hosts the app may contact: `api.groq.com`, `generativelanguage.googleapis.com`.

**Consent rules.** `ai.externalAnalysisEnabled` defaults `false`. Enabling requires, in `AnalysisSettingsSection`: choose provider → read `dataHandlingSummary` + `freeTierSummary` → paste API key (stored via `setSecret`, never in SQLite/backups/logs) → tick "I understand my meal photos will be sent to <provider>" → Enable. This sets `consentGrantedAt`, `consentProviderId`, `consentDisclosureVersion`. Consent is void (`no_consent`) if provider or `disclosureVersion` differs. Per-photo opt-out (`analysisOptOut`) always wins. Restoring a backup resets `ai` settings to defaults.

## 8. Backup folder format (v1)
User picks a folder via Android's directory picker (`Directory.pickDirectoryAsync`). The app creates `RecoveryFitness-Backup-YYYYMMDD-HHmmss/` inside it:
```
manifest.json            BackupManifest
data.json                { "tables": { "<table>": [ {col: value, ...}, ... ] } }   // raw SELECT * rows for every table in DB_TABLES_IN_RESTORE_ORDER
photos/food/<id>.jpg
photos/progress/<id>.jpg
```
Restore validates `formatVersion === 1` and `appSchemaVersion === DB_SCHEMA_VERSION` (else `fail('UNSUPPORTED')`), every `image_path` in food_entries/progress_photos exists, then: stage photos into the staging directory → single DB transaction (delete all tables in reverse order, insert in order) → commit staging photo root → reset `ai` settings → emit `data.restored`. Any failure before commit leaves existing data untouched. Original dates, lock states (derived + `early_unlocks`) and journeys are preserved because rows are copied verbatim. API keys are never exported.

## 9. Reminder scheduling contract (Agent 02)
- Channel id `reminders` (Android, default importance).
- Identifiers: `rem:exercise:<LocalDate>`, `rem:meal:<mealCategoryId>:<LocalDate>`, `rem:eod:<LocalDate>`. `syncReminders()` cancels every scheduled notification whose identifier starts with `rem:`, then schedules a rolling window of the next 7 local dates (today only if its time is still in the future). Idempotent ⇒ no duplicates.
- Exercise reminder: dates where ≥ 1 active exercise is scheduled; skip today if `getSessionDayStatus(today).completedSessionCount > 0`.
- Meal prompt (per enabled category): skip today if an entry already exists for that category today.
- End-of-day: body built at schedule time: `"<n> meal photo(s) logged · exercise: done | not done today | none scheduled"` (best-effort; refreshed on every sync).
- Content: title "Recovery & Fitness"; `data: { route: string }` using `ROUTES.*`.
- Triggers for `syncReminders()`: init, app foreground, and events `settings.changed`, `food.entry.saved`, `food.entry.deleted`, `session.saved`, `exercises.changed`, `data.restored`.
- Permission: never request at launch; request when the user enables a reminder. If denied, `ReminderSettingsSection` explains and offers `Linking.openSettings()`; reminder toggles stay off. Show `BATTERY_OPTIMISATION_NOTE`.

## 10. Milestone & journey rules (Agent 05; pure functions are unit-tested)
- `MILESTONE_DAYS = [30, 60, 90]`; unlock date = `addDays(startDate, day − 1)`.
- A photo with `dayNumber d` has `unlockMilestone` = smallest m ≥ d (d ≤ 0 → 30); `d > 90` → `null` (visible immediately).
- A milestone is unlocked iff `today ≥ unlockDate` OR an `early_unlocks` row exists. A photo is `visible` iff `unlockMilestone === null` or that milestone is unlocked.
- Early unlock: only the **next pending** milestone (smallest not unlocked); requires `{ confirmed: true }` else `VALIDATION`.
- Journey 1 is created at onboarding (start ≤ today). `startNextJourney()` is allowed only when the active journey's Day-90 milestone is unlocked (by date or early); it marks the current journey `completed` (`completedOn = today`) and creates journey `number+1` with `startDate = today`, `status='active'`. Photos belong to the journey active at capture and keep that `journeyId`. After Day 90 with no next journey started, new photos are visible immediately.
- `updateJourneyStartDate(id, newStart)`: `newStart ≤ today`; must not make any existing photo's day number < 1; for journey N>1 must be ≥ completedOn of journey N−1; the UI warns first that day numbers/unlock dates are recalculated (early unlocks are kept).
- Comparison pair for milestone m: `baseline` = earliest photo of the journey; `target` = photo with the greatest `dayNumber` in (previous milestone, m] (previous of 30 is 0); `target` = null if it is the baseline photo; `available` per type comment. Timeline: exact `dayNumber` matches only; default days `[1, 10, 30, 60, 90]` (`DEFAULT_TIMELINE_DAYS`).

## 11. Test conventions
Jest + `jest-expo`. Pure/repository tests use `/** @jest-environment node */`. Repository tests: `const db = await createTestDb(); setDbForTesting(db);` from `@/shared/db/testing/createTestDb` (Agent 01; backed by `sql.js`, applies `runMigrations`). Mock Expo native modules with `jest.mock(...)` inside the test file. Tests live in `src/<area>/**/__tests__/*.test.ts(x)`. Honest reporting: handover must state which tests were actually executed.
