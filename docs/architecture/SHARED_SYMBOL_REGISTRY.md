# SHARED_SYMBOL_REGISTRY.md — Recovery & Fitness App

**Version 1.0 · 2026-10-11.** All entries are **APPROVED** and **MANDATORY** unless marked `(opt)`. Owner = the agent that writes the defining file. Types listed here are declared verbatim in `SHARED_CONTRACT.md` §3 (Agent 01 copies them); the "Defined in" path is where they must live.
**ID scheme:** `<KIND>-<AREA>-<NNN>`; KIND ∈ TYPE, CLS, API (function/service/object), CMP (React component), HOOK, CONST, EVT, TBL. In code, cite IDs in `INTEGRATION CONTRACT:` and `// CONTRACT:` comments. Ranges are written `ID..NNN`.
**Testing rule for every API/HOOK entry:** the owner ships unit tests (happy path, validation errors, boundary values); repository functions are tested with `createTestDb()` (API-DB-004). Components get a render smoke test where practical. Consumers never re-implement a registry symbol.
**Import rule:** shared symbols are imported by deep path (`@/shared/<path-without-extension>`); module symbols ONLY from the module index (`@/modules/<name>`).
**Entry format:** `ID` `signature` · Owner · Defined in · Async? · Errors · Consumers.

---
## CORE — `@/shared/types/common`, `@/shared/errors/*`, `@/shared/utils/*`
- **TYPE-CORE-001** `Id = string` · A1 · `src/shared/types/common.ts` · all
- **TYPE-CORE-002** `IsoDateTime = string` · A1 · same · all
- **TYPE-CORE-003** `LocalDate = string` · A1 · same · all
- **TYPE-CORE-004** `LocalTime = string` · A1 · same · A2, A7
- **TYPE-CORE-005** `Unsubscribe = () => void` · A1 · same · A1, A2
- **TYPE-CORE-006** `Result<T>` · A1 · same · A3, A4, A2, A5
- **TYPE-CORE-007** `DeepPartial<T>` · A1 · same · A1
- **TYPE-CORE-008** `AppErrorCode` · A1 · `src/shared/errors/AppError.ts` · all
- **CLS-CORE-001** `class AppError extends Error` (CONTRACT §3.2) · A1 · same · all
- **API-CORE-001** `isAppError(e: unknown): e is AppError` · A1 · same · sync · all
- **API-CORE-002** `toAppError(e: unknown, fallback?: AppErrorCode): AppError` · A1 · same · sync · all (default fallback `'UNKNOWN'`)
- **API-CORE-003** `ok<T>(value: T): Result<T>` · A1 · `src/shared/errors/result.ts` · sync · A3, A4, A5
- **API-CORE-004** `fail(error: AppError | AppErrorCode, message?: string): Result<never>` · A1 · same · sync · A3, A4, A5
- **API-CORE-005** `newId(): Id` (UUID v4) · A1 · `src/shared/utils/ids.ts` · sync · A2, A3, A5, A6
- **API-CORE-006** `nowIso(): IsoDateTime` · A1 · `src/shared/utils/dates.ts` · sync · all repos
- **API-CORE-007** `logger: { debug(m: string, ctx?: Record<string, unknown>): void; info(...): void; warn(...): void; error(...): void }` (redacts keys named `uri`, `path`, `image*`, `base64`, `apiKey`, `note*`, `notes`) · A1 · `src/shared/utils/logger.ts` · all

## DATE — `@/shared/utils/dates` (all A1; sync; consumers: all unless noted; all DST-safe, pure)
- **API-DATE-001** `toLocalDate(d: Date): LocalDate`
- **API-DATE-002** `todayLocal(now?: Date): LocalDate`
- **API-DATE-003** `parseLocalDate(s: LocalDate): Date` (local midnight; throws `VALIDATION` if invalid)
- **API-DATE-004** `addDays(date: LocalDate, n: number): LocalDate`
- **API-DATE-005** `diffCalendarDays(from: LocalDate, to: LocalDate): number` (to − from, integer)
- **API-DATE-006** `getDayNumber(startDate: LocalDate, onDate: LocalDate): number` (= diff + 1; may be ≤ 0 before start)
- **API-DATE-007** `getIsoWeekday(date: LocalDate): Weekday`
- **API-DATE-008** `isValidLocalDate(s: string): s is LocalDate`
- **API-DATE-009** `listDatesInRange(from: LocalDate, to: LocalDate): LocalDate[]` (inclusive; empty if to < from)
- **API-DATE-010** `combineLocalDateTime(date: LocalDate, time: LocalTime): Date`
- **API-DATE-011** `formatDisplayDate(date: LocalDate): string` (e.g. "Mon 12 Oct 2026")

## UNIT — `@/shared/utils/units` (all A1; sync; consumers: A6, A7, A2)
- **API-UNIT-001** `kgToLb(kg: number): number` · **002** `lbToKg(lb: number): number` · **003** `cmToIn(cm: number): number` · **004** `inToCm(i: number): number`
- **API-UNIT-005** `toKg(value: number, unit: string): number | null` (`'kg'`,`'lb'`; else null)
- **API-UNIT-006** `formatWeight(kg: number, units: UnitSystem): string` · **007** `formatLength(cm: number, units: UnitSystem): string` · **008** `weightUnitLabel(units: UnitSystem): 'kg' | 'lb'`

## DB — `@/shared/db/*` (A1)
- **TYPE-DB-001** `SqlParam` · `src/shared/db/types.ts` · A1
- **TYPE-DB-002** `Db` (CONTRACT §3.11) · same · all repositories, A4 backup
- **API-DB-001** `getDb(): Promise<Db>` (opens once, `PRAGMA foreign_keys=ON`, runs migrations, memoized) · `src/shared/db/database.ts` · async · errors `STORAGE` · all repositories
- **API-DB-002** `runMigrations(db: Db): Promise<void>` (uses `PRAGMA user_version`) · `src/shared/db/migrations.ts` · async · A1 tests, createTestDb
- **API-DB-003** `setDbForTesting(db: Db | null): void` · `src/shared/db/database.ts` · sync · all tests
- **API-DB-004** `createTestDb(): Promise<Db>` (sql.js in-memory + migrations) · `src/shared/db/testing/createTestDb.ts` · async · all tests only
- **CONST-DB-001** `DB_SCHEMA_VERSION: number` (= 1) · `src/shared/db/migrations.ts` · A4
- **CONST-DB-002** `DB_TABLES_IN_RESTORE_ORDER: readonly string[]` (see DATA_MODEL §3) · same · A4
- Tables **TBL-DB-001..012** (DDL in DATA_MODEL_AND_STORAGE.md): 001 `profile` (A1), 002 `settings` (A1), 003 `journeys` (A5), 004 `early_unlocks` (A5), 005 `exercises` (A2), 006 `sessions` (A2), 007 `session_exercise_results` (A2), 008 `meal_categories` (A3), 009 `food_entries` (A3), 010 `progress_photos` (A5), 011 `measurements` (A6), 012 `journal_entries` (A6). Schema/migration file owner: A1; "(Ax)" = the only module allowed to write the table.

## FILE / SEC — private photos and secrets (A1)
- **TYPE-FILE-001** `PhotoKind = 'food' | 'progress'` · `src/shared/files/photoStorage.ts`
- **TYPE-FILE-002** `StoredPhoto { relativePath: string; byteSize: number }` · same
- **API-FILE-001** `savePhotoFromUri(p: { kind: PhotoKind; id: Id; sourceUri: string }): Promise<StoredPhoto>` (copy to `<root>/<kind>/<id>.jpg`, delete source temp) · async · `STORAGE` · A3, A5
- **API-FILE-002** `resolvePhotoUri(relativePath: string): string` (absolute `file://` URI; rejects `..`) · sync · A3, A5, A4
- **API-FILE-003** `deletePhoto(relativePath: string): Promise<void>` (idempotent) · A3, A5
- **API-FILE-004** `photoExists(relativePath: string): Promise<boolean>` · A3, A5, A4
- **API-FILE-005** `listStoredPhotos(): Promise<StoredPhoto[]>` · A4
- **API-FILE-006** `prepareStagingPhotoRoot(): Promise<string>` (empty staging dir URI) · A4
- **API-FILE-007** `commitStagingPhotoRoot(): Promise<void>` (replace live photo root with staging) · A4
- **API-FILE-008** `discardStagingPhotoRoot(): Promise<void>` · A4
- **API-FILE-009** `getPhotoRootUri(): string` · A4
- **TYPE-SEC-001** `SecretKey = 'ai.apiKey.groq' | 'ai.apiKey.gemini'` · `src/shared/platform/secureStorage.ts`
- **API-SEC-001** `getSecret(key: SecretKey): Promise<string | null>` · **002** `setSecret(key: SecretKey, value: string): Promise<void>` · **003** `deleteSecret(key: SecretKey): Promise<void>` · A1 · consumers A4 only

## EVT — `@/shared/events/appEvents` (A1)
- **TYPE-EVT-001** `AppEventMap` · `src/shared/types/events.ts` · **TYPE-EVT-002** `AppEventName`
- **API-EVT-001** `appEvents: { on<K extends AppEventName>(name: K, handler: (p: AppEventMap[K]) => void): Unsubscribe; emit<K extends AppEventName>(name: K, payload: AppEventMap[K]): void }` · sync; handler exceptions are caught and logged, never propagate to emitter
- **HOOK-EVT-001** `useAppEvent<K extends AppEventName>(name: K, handler: (p: AppEventMap[K]) => void): void` · `src/shared/events/appEvents.ts` · A2, A3, A5, A6 screens
- **EVT-SET-001** `'settings.changed'` (emit A1; sub A1 SettingsProvider, A2) · **EVT-FOOD-001** `'food.entry.saved'` (emit A3; sub A2) · **EVT-FOOD-002** `'food.entry.deleted'` (emit A3; sub A2) · **EVT-TRN-001** `'session.saved'` (emit A2; sub A2) · **EVT-TRN-002** `'exercises.changed'` (emit A2; sub A2) · **EVT-DB-001** `'data.restored'` (emit A4; sub A1, A2)

## SET — profile & settings (A1)
- **TYPE-SET-001** `UnitSystem` · **002** `Profile` · **003** `ProfileUpdate` — `src/shared/types/profile.ts`
- **TYPE-SET-004** `AiProviderId` · **005** `MealReminderSetting` · **006** `RemindersSettings` · **007** `AiSettings` · **008** `AppSettings` — `src/shared/types/settings.ts`
- **CONST-SET-001** `DEFAULT_APP_SETTINGS: AppSettings` (CONTRACT §6 defaults: calorie display on; reminders off; exercise 08:00, end-of-day 21:00; AI off, all null) · `src/shared/constants/settings.ts` · A1
- **CONST-SET-002** `DEFAULT_MEAL_REMINDER_TIMES: Record<Id, LocalTime>` = `{'meal-breakfast':'08:30','meal-lunch':'13:00','meal-snacks':'16:30','meal-dinner':'20:00'}` · same · A2
- **API-SET-001** `getProfile(): Promise<Profile>` (creates default row if absent) · `src/shared/data/profileRepository.ts` · async · A7, A6
- **API-SET-002** `updateProfile(update: ProfileUpdate): Promise<Profile>` · same · `VALIDATION` (height 50–260 cm, baseline weight 20–400 kg) · A7
- **API-SET-003** `completeOnboarding(): Promise<Profile>` · same · A7
- **API-SET-004** `acknowledgeDisclaimer(): Promise<Profile>` · same · A7
- **API-SET-005** `getSettings(): Promise<AppSettings>` (defaults merged under stored values) · `src/shared/settings/settingsRepository.ts` · A2, A3, A4, A6
- **API-SET-006** `updateSettings(patch: DeepPartial<AppSettings>): Promise<AppSettings>` (deep-merge, emits EVT-SET-001, validates `painAlertLevel` int 0–10/null, targets > 0/null, HH:mm) · same · `VALIDATION` · A2, A3, A4, A7
- **API-SET-007** `resetAiConsent(): Promise<AppSettings>` (resets `ai` to defaults) · same · A4
- **CMP-SET-001** `SettingsProvider({ children }): JSX.Element` · `src/shared/settings/SettingsProvider.tsx` · A7 (mounts it)
- **HOOK-SET-001** `useSettings(): { settings: AppSettings; loading: boolean; update(patch: DeepPartial<AppSettings>): Promise<void> }` · same · A2, A3, A4, A6, A7

## SAFE / TEXT / ACT — safety, fixed text, activity calories (A1)
- **TYPE-SAFE-001** `SymptomFlag` · **002** `SymptomReport` · **003** `SafetyAdvice` — `src/shared/types/safety.ts`
- **API-SAFE-001** `evaluateSymptomReport(report: SymptomReport, painAlertLevel: number | null): SafetyAdvice | null` — advice iff `flags.length > 0` OR (`painAlertLevel !== null && painScore !== null && painScore >= painAlertLevel`); `reasons` = flag labels + `"Pain {n}/10 (your alert level: {m})"`; uses CONST-TEXT-002/003 · `src/shared/domain/safety.ts` · sync · A2, A6
- **CMP-SAFE-001** `SymptomChecklist(props: { value: SymptomReport; onChange(next: SymptomReport): void })` (checkbox per flag + 0–10 pain selector, optional) · `src/shared/ui/safetyUi.tsx` · A2, A6
- **CMP-SAFE-002** `SafetyAdviceCard(props: { advice: SafetyAdvice })` · same · A2, A6
- **CONST-TEXT-001** `HEALTH_DISCLAIMER_TEXT` · **002** `SAFETY_ADVICE_TITLE` · **003** `SAFETY_ADVICE_MESSAGE` · **004** `ESTIMATE_DISCLAIMER_TEXT` · **005** `LOCK_NOTE_TEXT` · **006** `WORKOUT_KCAL_LABEL` · **007** `BACKUP_PRIVACY_WARNING` · **008** `BATTERY_OPTIMISATION_NOTE` · **009** `SYMPTOM_FLAG_LABELS` · **010** `INTENSITY_MET` — `src/shared/constants/text.ts`, values verbatim from CONTRACT §6. Consumers: 001 A7; 002/003 A1(safety); 004 A3, A7; 005 A5, A7; 006 A2, A6; 007 A4; 008 A2; 009 A1(safety UI), A6; 010 A1 (activityCalories).
- **API-ACT-001** `estimateExerciseKcal(p: { intensity: ExerciseIntensity | null; weightKg: number | null; activeSeconds: number }): number | null` — `round(MET × weightKg × activeSeconds/3600)`; null if intensity/weight null or activeSeconds ≤ 0 · `src/shared/domain/activityCalories.ts` · sync · A2
- **API-ACT-002** `estimateSessionKcal(results: Array<Pick<SessionExerciseResult, 'intensity' | 'activeSeconds'>>, weightKg: number | null): number | null` (sum of non-null; null if all null) · same · A2
- **API-ACT-003** `getReferenceWeightKg(): Promise<number | null>` (latest `measurements` row of type weight converted via `toKg`, else `profile.baselineWeightKg`, else null) · `src/shared/data/referenceWeight.ts` · async · A2

## UI — `@/shared/ui/*` (A1)
- **TYPE-UI-001** `Theme { colors: { background; surface; text; textMuted; primary; primaryText; border; danger; warning; success: string }; spacing: { xs: 4; sm: 8; md: 16; lg: 24; xl: 32 }; radius: { sm: 6; md: 12 }; fontSize: { sm: 13; md: 16; lg: 20; xl: 28 } }` · `src/shared/ui/theme.ts`
- **HOOK-UI-001** `useTheme(): Theme` (follows system light/dark) · same · all screens
- **HOOK-UI-002** `useFocusLoad<T>(loader: () => Promise<T>, deps: React.DependencyList): { data: T | null; loading: boolean; error: AppError | null; reload(): void }` (runs on focus, on deps change, and on `data.restored`; ignores stale results) · `src/shared/ui/useFocusLoad.ts` · all screens
- **API-UI-001** `confirmAction(o: { title: string; message: string; confirmLabel: string; cancelLabel?: string; destructive?: boolean }): Promise<boolean>` · `src/shared/ui/confirmAction.ts` · A2, A3, A4, A5, A6, A7
- **CMP-UI-001** `Screen(props: { children; scroll?: boolean; padded?: boolean })` — `src/shared/ui/Screen.tsx`
- **CMP-UI-002** `AppText(props: { variant?: 'title'|'heading'|'body'|'caption'|'label'; muted?: boolean; children; style? })` — `AppText.tsx`
- **CMP-UI-003** `Button(props: { label: string; onPress(): void; variant?: 'primary'|'secondary'|'danger'|'ghost'; disabled?: boolean; loading?: boolean })` — `Button.tsx`
- **CMP-UI-004** `Card(props: { children; onPress?(): void; style? })` — `Card.tsx`
- **CMP-UI-005** `TextField(props: { label: string; value: string; onChangeText(t: string): void; multiline?: boolean; placeholder?: string; error?: string | null })` · **006** `NumberField(props: { label: string; value: number | null; onChange(v: number | null): void; min?: number; max?: number; integer?: boolean; unit?: string; error?: string | null })` · **007** `DateField(props: { label: string; value: LocalDate; onChange(d: LocalDate): void; maxDate?: LocalDate; minDate?: LocalDate })` · **008** `TimeField(props: { label: string; value: LocalTime; onChange(t: LocalTime): void })` — all in `fields.tsx`
- **CMP-UI-009** `Chip(props: { label: string; selected?: boolean; onPress?(): void })` · **010** `Segmented<T extends string>(props: { options: Array<{ value: T; label: string }>; value: T; onChange(v: T): void })` — `Chip.tsx`
- **CMP-UI-011** `SectionHeader(props: { title: string; action?: { label: string; onPress(): void } })` · **012** `EmptyState(props: { title: string; message?: string; action?: { label: string; onPress(): void } })` · **013** `LoadingView()` · **014** `ErrorBanner(props: { error: AppError | string | null })` — `feedback.tsx`
- **CMP-UI-015** `PhotoCapture(props: { facing?: 'front' | 'back'; title?: string; onCaptured(tempUri: string): void; onCancel(): void })` — permission request + explanation + "Open settings" on denial; capture with `exif: false`; never saves to gallery · `PhotoCapture.tsx` · A3, A5
- **CONST-NAV-001** `ROUTES` (CONTRACT §4) · `src/shared/navigation/routes.ts` · all screens, A7

---
## TRN — `@/modules/training` (A2). Types in `src/shared/types/training.ts`
- **TYPE-TRN-001** `Weekday` · **002** `ExerciseStatus` · **003** `ExerciseIntensity` · **004** `Exercise` · **005** `ExerciseInput` · **006** `SessionStatus` · **007** `SessionExerciseStatus` · **008** `SessionExerciseResult` · **009** `Session` · **010** `SaveSessionInput` · **011** `SessionDayStatus` (A1 writes; consumers A2, A6, A1 activityCalories)
- **API-TRN-001** `listExercises(opts?: { includePaused?: boolean }): Promise<Exercise[]>` (ordered by `sortOrder`; default active only) · `src/modules/training/data/exerciseRepository.ts` · consumers: A2
- **API-TRN-002** `getExercise(id: Id): Promise<Exercise>` · `NOT_FOUND`
- **API-TRN-003** `createExercise(input: ExerciseInput): Promise<Exercise>` · `VALIDATION` (name non-empty; sets ≥ 1; reps or duration present; weekdays 1–7 unique; rest ≥ 0); appends sortOrder; emits EVT-TRN-002
- **API-TRN-004** `updateExercise(id: Id, patch: Partial<ExerciseInput>): Promise<Exercise>` · `NOT_FOUND`/`VALIDATION`; emits EVT-TRN-002
- **API-TRN-005** `deleteExercise(id: Id): Promise<void>` (history keeps name snapshot; FK SET NULL); emits EVT-TRN-002
- **API-TRN-006** `reorderExercises(orderedIds: Id[]): Promise<void>` (must list every existing id exactly once else `VALIDATION`); emits EVT-TRN-002
- **API-TRN-007** `listExercisesScheduledFor(date: LocalDate): Promise<Exercise[]>` (active only, weekday match) · consumers A2 (reminders, Today card), A6 (daily summary)
- **API-TRN-008** `saveSession(input: SaveSessionInput): Promise<Session>` (computes `localDate` from `startedAt`, `estimatedKcal` via API-ACT-002 + API-ACT-003; emits EVT-TRN-001) · `src/modules/training/data/sessionRepository.ts` · `VALIDATION`
- **API-TRN-009** `getSession(id: Id): Promise<Session>` · `NOT_FOUND` · **010** `listSessions(opts?: { from?: LocalDate; to?: LocalDate; limit?: number }): Promise<Session[]>` (newest first) · **011** `listSessionsForDate(date: LocalDate): Promise<Session[]>` · **012** `updateSessionReflection(id: Id, patch: { effortRating?: number | null; notes?: string | null; painScore?: number | null; symptomFlags?: SymptomFlag[] }): Promise<Session>` (effort 1–10, pain 0–10) · **013** `deleteSession(id: Id): Promise<void>` · **014** `getSessionDayStatus(date: LocalDate): Promise<SessionDayStatus>` · **015** `getCompletedSessionCountsByDate(from: LocalDate, to: LocalDate): Promise<Record<LocalDate, number>>` — consumers: 009–013 A2 UI, A6 (011, 015), A2 reminders (014)
- **CMP-TRN-001** `ExerciseListScreen(): JSX.Element` · **002** `ExerciseEditorScreen(props: { exerciseId: Id | null })` · **003** `SessionRunScreen(props: { plannedExerciseIds: Id[] | null })` · **004** `SessionCompleteScreen(props: { sessionId: Id })` · **005** `SessionHistoryScreen()` · **006** `SessionDetailScreen(props: { sessionId: Id })` · **007** `TodayExerciseCard()` — `src/modules/training/screens/*`, `components/TodayExerciseCard.tsx` · consumers A7

## REM — `@/modules/reminders` (A2)
- **TYPE-REM-001** `NotificationPermissionState = 'granted' | 'denied' | 'undetermined'` · `src/modules/reminders/types.ts`
- **API-REM-001** `initializeReminders(): Promise<void>` (set handler, create channel, subscribe to events + AppState foreground, initial `syncReminders`; idempotent) · `src/modules/reminders/reminderService.ts` · A7 bootstrap
- **API-REM-002** `syncReminders(): Promise<void>` (CONTRACT §9; never throws; no-op if permission not granted) · same · A7 (optional manual call)
- **API-REM-003** `getNotificationPermissionState(): Promise<NotificationPermissionState>` · same · A2 UI
- **API-REM-004** `requestNotificationPermission(): Promise<NotificationPermissionState>` · same · A2 UI
- **HOOK-REM-001** `useReminderNotificationRouting(): void` (routes `data.route` of a tapped notification, including cold start) · `src/modules/reminders/useReminderNotificationRouting.ts` · A7 root layout
- **CMP-REM-001** `ReminderSettingsSection()` · `src/modules/reminders/ReminderSettingsSection.tsx` · A7 Settings

## FOOD — `@/modules/food` (A3). Types in `src/shared/types/food.ts`
- **TYPE-FOOD-001** `MealCategory` · **002** `NutritionSource` · **003** `Confidence` · **004** `AnalysisStatus` · **005** `NutritionValues` · **006** `NutritionTotals` · **007** `FoodItem` · **008** `FoodEntry` · **009** `CreateFoodEntryInput` · **010** `FoodEntryDetailsPatch` · **011** `DailyNutritionTotals` (A1 writes; consumers A3, A4 (005, 003), A6, A2)
- **API-FOOD-001** `listMealCategories(opts?: { includeArchived?: boolean }): Promise<MealCategory[]>` · `src/modules/food/data/mealCategoryRepository.ts` · consumers A3, A2 (reminders)
- **API-FOOD-002** `createMealCategory(name: string): Promise<MealCategory>` (`VALIDATION` empty/duplicate, ≤ 30 chars) · **003** `renameMealCategory(id: Id, name: string): Promise<MealCategory>` · **004** `archiveMealCategory(id: Id): Promise<void>` (`CONFLICT` for default categories; entries keep working) · **005** `reorderMealCategories(orderedIds: Id[]): Promise<void>`
- **API-FOOD-006** `createFoodEntryFromPhoto(input: CreateFoodEntryInput): Promise<FoodEntry>` — copies photo into private storage, inserts, sets `analysisStatus`: `skipped_by_user` if `analysisOptOut` and analysis available; `pending` if availability `ready` and not opted out; else `not_requested`; emits EVT-FOOD-001; starts analysis in background (not awaited, errors swallowed into entry status) · `src/modules/food/data/foodRepository.ts` · `VALIDATION`, `STORAGE`, `NOT_FOUND` (category)
- **API-FOOD-007** `getFoodEntry(id: Id): Promise<FoodEntry>` · `NOT_FOUND` · **008** `listFoodEntriesForDate(date: LocalDate): Promise<FoodEntry[]>` (capturedAt ascending) · consumers 008: A3, A2 (reminders), A6 (via totals only)
- **API-FOOD-009** `updateFoodEntryDetails(id: Id, patch: FoodEntryDetailsPatch): Promise<FoodEntry>` (changing `capturedAt` recomputes `localDate`)
- **API-FOOD-010** `saveManualNutrition(id: Id, values: NutritionValues): Promise<FoodEntry>` → `nutritionSource='manual'`, `confidence='unknown'` · **011** `confirmAiEstimate(id: Id, edited?: Partial<NutritionValues>): Promise<FoodEntry>` → `'confirmed'` (`CONFLICT` unless current source is `ai_estimate` or `confirmed`) · **012** `markNutritionUnknown(id: Id): Promise<FoodEntry>` → source `unknown`, values null · **013** `scaleEntryPortion(id: Id, factor: number): Promise<FoodEntry>` (factor 0.25–4 else `VALIDATION`; `CONFLICT` if no values; an `ai_estimate` becomes `confirmed` because the user adjusted it; `manual`/`confirmed` keep their source)
- **API-FOOD-014** `deleteFoodEntry(id: Id): Promise<void>` (deletes DB row and image; emits EVT-FOOD-002)
- **API-FOOD-015** `analyzeFoodEntry(id: Id, options?: { clarification?: { question: string; answer: string }; overwrite?: boolean }): Promise<FoodEntry>` — `src/modules/food/services/analysisService.ts`. Throws only `NOT_FOUND`, `CONSENT_REQUIRED` (entry `analysisOptOut` true), `CONFLICT` (source `manual`/`confirmed` and not `overwrite`). Analysis failures are recorded: `OFFLINE`/`NETWORK`/`RATE_LIMITED` → status `pending` + `analysisError`; others → `failed`. Success → status `succeeded`, source `ai_estimate`, `pendingClarification` set/cleared. Consumers A3 UI
- **API-FOOD-016** `processPendingAnalyses(): Promise<{ processed: number; failed: number }>` (sequential, max 5 per call, stops at first `RATE_LIMITED`; skips opted-out entries; no-op when availability not `ready`) · same file · A7 foreground hook, A3 UI
- **API-FOOD-017** `getDailyNutritionTotals(date: LocalDate): Promise<DailyNutritionTotals>` · `src/modules/food/domain/totals.ts` (+ repo query) · A3, A6 · **018** `getNutritionTotalsForRange(from: LocalDate, to: LocalDate): Promise<DailyNutritionTotals[]>` (one element per date, empty days included) · A6
- **API-FOOD-019** `sumNutrition(values: NutritionValues[]): NutritionTotals` (sync, pure; macros null if no entry has the value) · `src/modules/food/domain/nutritionMath.ts` · A3 · **020** `scaleNutrition(values: NutritionValues, factor: number): NutritionValues` (kcal → integer, grams → 1 decimal; nulls stay null)
- **CMP-FOOD-001** `FoodLogScreen()` · **002** `FoodCaptureScreen(props: { mealCategoryId: Id | null })` · **003** `FoodEntryScreen(props: { entryId: Id })` · **004** `MealCategoriesScreen()` · **005** `TodayFoodCard()` · **006** `NutritionTargetsSettingsSection()` — consumers A7

## AI — `@/modules/nutrition-ai` (A4). Types in `src/shared/types/nutritionAi.ts`
- **TYPE-AI-001** `ClarificationQuestion` · **002** `EstimatedFoodItem` · **003** `NutritionEstimateRequest` · **004** `NutritionEstimate` · **005** `AnalysisAvailability` · **006** `AiProviderInfo` (A1 writes; consumers A3, A4)
- **API-AI-001** `getAnalysisAvailability(): Promise<AnalysisAvailability>` — order: `disabled` (not enabled) → `no_provider` → `no_consent` (consent provider/version mismatch or null) → `no_api_key` → `ready` · `src/modules/nutrition-ai/availability.ts` · A3
- **API-AI-002** `estimateNutritionFromImage(req: NutritionEstimateRequest): Promise<Result<NutritionEstimate>>` (CONTRACT §7) · `src/modules/nutrition-ai/estimateService.ts` · async · errors in `Result`: `CONSENT_REQUIRED`, `NOT_CONFIGURED`, `VALIDATION`, `OFFLINE`, `NETWORK`, `RATE_LIMITED`, `PROVIDER_ERROR`, `PARSE_ERROR`, `CANCELLED` · A3
- **API-AI-003** `listAiProviders(): AiProviderInfo[]` (returns `AI_PROVIDER_CATALOG`) · `src/modules/nutrition-ai/providers/catalog.ts` · sync · A4 UI
- **CMP-AI-001** `AnalysisSettingsSection()` · `src/modules/nutrition-ai/AnalysisSettingsSection.tsx` · A7

## BKP — `@/modules/backup` (A4). Types in `src/shared/types/backup.ts`
- **TYPE-BKP-001** `BackupManifest` · **002** `BackupExportResult` · **003** `RestoreResult` · **004** `BackupProgress` (A1 writes)
- **API-BKP-001** `exportBackup(opts?: { onProgress?: (p: BackupProgress) => void }): Promise<Result<BackupExportResult>>` (opens directory picker; `CANCELLED` if dismissed) · `src/modules/backup/exporter.ts`
- **API-BKP-002** `previewBackup(): Promise<Result<{ manifest: BackupManifest; folderUri: string }>>` (picker + validate manifest) · `src/modules/backup/restorer.ts`
- **API-BKP-003** `restoreBackup(folderUri: string, opts: { confirmed: boolean; onProgress?: (p: BackupProgress) => void }): Promise<Result<RestoreResult>>` (`VALIDATION` unless `confirmed === true`; semantics CONTRACT §8; emits EVT-DB-001) · `src/modules/backup/restorer.ts`
- **CMP-BKP-001** `BackupScreen()` · **002** `BackupSettingsSection()` (link row + `BACKUP_PRIVACY_WARNING`) — consumers A7

## PHOTO — `@/modules/photos` (A5). Types in `src/shared/types/photos.ts`
- **TYPE-PHOTO-001** `JourneyStatus` · **002** `Journey` · **003** `MilestoneDay` · **004** `ProgressPhotoCategory` · **005** `ProgressPhotoView` · **006** `MilestoneState` · **007** `ComparisonPair` · **008** `TimelineSlot` · **009** `AddProgressPhotoInput` (A1 writes)
- **CONST-PHOTO-001** `MILESTONE_DAYS: readonly [30, 60, 90]` · **002** `DEFAULT_TIMELINE_DAYS: readonly number[]` = `[1, 10, 30, 60, 90]` · `src/modules/photos/domain/milestones.ts`
- **API-PHOTO-001** `getActiveJourney(): Promise<Journey | null>` · `src/modules/photos/data/journeyRepository.ts` · A7
- **API-PHOTO-002** `createFirstJourney(startDate: LocalDate): Promise<Journey>` (`VALIDATION` if > today or invalid; `CONFLICT` if a journey exists) · A7 onboarding
- **API-PHOTO-003** `listJourneys(): Promise<Journey[]>` (ascending number) · A5 UI
- **API-PHOTO-004** `updateJourneyStartDate(journeyId: Id, newStartDate: LocalDate): Promise<Journey>` (rules CONTRACT §10; `VALIDATION`) · A5 settings section
- **API-PHOTO-005** `startNextJourney(): Promise<Journey>` (`CONFLICT` unless active journey's Day 90 is unlocked) · A5 UI
- **API-PHOTO-006** `addProgressPhoto(input: AddProgressPhotoInput): Promise<ProgressPhotoView>` (journey = active; `NOT_FOUND` if none; saves image via API-FILE-001) · `src/modules/photos/data/photoRepository.ts` · A5 capture screen (A2 only embeds the prompt card)
- **API-PHOTO-007** `listProgressPhotos(journeyId: Id): Promise<ProgressPhotoView[]>` (`imageUri` null when locked) · **008** `getMilestoneStates(journeyId: Id): Promise<MilestoneState[]>` · **009** `unlockMilestoneEarly(journeyId: Id, day: MilestoneDay, opts: { confirmed: boolean }): Promise<void>` (`VALIDATION` unless confirmed or day isn't next pending; `CONFLICT` if already unlocked) · **010** `deleteProgressPhoto(id: Id): Promise<void>` · **012** `getComparisonPairs(journeyId: Id): Promise<ComparisonPair[]>` · **013** `getTimelineSlots(journeyId: Id, days?: number[]): Promise<TimelineSlot[]>` — same file
- **API-PHOTO-011** `exportProgressPhoto(id: Id): Promise<Result<void>>` (share sheet via `expo-sharing`; `LOCKED` if not visible) · `src/modules/photos/services/photoExport.ts`
- **API-PHOTO-014** `getMilestoneUnlockDate(startDate: LocalDate, day: MilestoneDay): LocalDate` · **015** `getUnlockMilestoneForDay(dayNumber: number): MilestoneDay | null` · **016** `isMilestoneUnlocked(p: { startDate: LocalDate; today: LocalDate; day: MilestoneDay; earlyUnlockedDays: MilestoneDay[] }): boolean` · **017** `getNextPendingMilestone(p: { startDate: LocalDate; today: LocalDate; earlyUnlockedDays: MilestoneDay[] }): MilestoneDay | null` — pure, sync · `src/modules/photos/domain/milestones.ts`
- **HOOK-PHOTO-001** `useActiveJourney(): { journey: Journey | null; dayNumber: number | null; loading: boolean; reload(): void }` · `src/modules/photos/hooks/useActiveJourney.ts` · A7
- **CMP-PHOTO-001** `PhotosHomeScreen()` · **002** `ProgressPhotoCaptureScreen(props: { sessionId: Id | null })` · **003** `PhotoComparisonScreen(props: { journeyId: Id; milestoneDay: MilestoneDay })` · **004** `PhotoTimelineScreen(props: { journeyId: Id })` · **005** `JourneysScreen()` · **006** `TodayMilestoneCard()` · **007** `ProgressPhotoPromptCard(props: { sessionId: Id })` (consumer **A2**) · **008** `JourneySettingsSection()` (consumer A7)

## BODY — `@/modules/body` (A6). Types in `src/shared/types/body.ts`
- **TYPE-BODY-001** `MeasurementType` · **002** `Measurement` · **003** `MeasurementInput` · **004** `WeightPoint` (A1 writes; consumers A6)
- **API-BODY-001** `addMeasurement(input: MeasurementInput): Promise<Measurement>` (`VALIDATION`: value > 0, weight 20–400 kg-equivalent, unit non-empty, custom needs label, `measuredAt` not future) · `src/modules/body/data/measurementRepository.ts`
- **API-BODY-002** `updateMeasurement(id: Id, patch: Partial<MeasurementInput>): Promise<Measurement>` · **003** `deleteMeasurement(id: Id): Promise<void>` · **004** `listMeasurements(opts?: { type?: MeasurementType; customLabel?: string; from?: LocalDate; to?: LocalDate }): Promise<Measurement[]>` (date ascending) · consumers A6 progress
- **API-BODY-005** `getWeightSeriesKg(opts?: { from?: LocalDate; to?: LocalDate }): Promise<WeightPoint[]>` (one point per date = latest that day, via `toKg`; unconvertible units skipped) · consumers A6 progress
- **CMP-BODY-001** `MeasurementsScreen()` · consumer A7

## JRN — `@/modules/journal` (A6). Types in `src/shared/types/journal.ts`
- **TYPE-JRN-001** `SwellingLevel` · **002** `JournalEntry` · **003** `JournalEntryInput`
- **API-JRN-001** `createJournalEntry(input: JournalEntryInput): Promise<JournalEntry>` (at least one field set else `VALIDATION`; scores 0–10) · `src/modules/journal/data/journalRepository.ts` · **002** `updateJournalEntry(id: Id, patch: JournalEntryInput): Promise<JournalEntry>` · **003** `deleteJournalEntry(id: Id): Promise<void>` · **004** `listJournalEntries(opts?: { from?: LocalDate; to?: LocalDate; limit?: number }): Promise<JournalEntry[]>` (newest first) · **005** `getJournalEntriesForDate(date: LocalDate): Promise<JournalEntry[]>` · **006** `getJournalEntry(id: Id): Promise<JournalEntry>` (`NOT_FOUND`) — consumers 005: A6 progress
- **CMP-JRN-001** `JournalScreen()` · **002** `JournalEntryScreen(props: { entryId: Id | null })` · consumers A7

## PRG — `@/modules/progress` (A6). Types in `src/shared/types/summary.ts`
- **TYPE-PRG-001** `DailySummary`
- **API-PRG-001** `getDailySummary(date: LocalDate): Promise<DailySummary>` · `src/modules/progress/services/dailySummary.ts` · uses API-TRN-007/011, API-FOOD-017, API-BODY-004, API-JRN-005, API-SET-005 · consumers A6 UI
- **CMP-PRG-001** `ProgressScreen()` (charts: weight trend + 7-day average, daily calories/protein vs optional targets, exercise consistency by week, other measurements; links to Measurements, Journal, Session history, Daily summary) · **002** `DailySummaryScreen(props: { date: LocalDate })` — consumers A7

## SHELL — A7 (not consumed by modules)
- **CMP-SHELL-001** `AppProviders` · **002** `TodayScreen` · **003** `SettingsScreen` · **004** `OnboardingScreen` · **005** `SetupGate` — `src/shell/*`, exported from `src/shell/index.ts`
- **API-SHELL-001** `bootstrapApp(): Promise<void>` (getDb → initializeReminders → AppState foreground listener for processPendingAnalyses) · `src/shell/bootstrap.ts`

---
## Dependency edges implied by consumers (must match CONTRACT §2.8)
`training → photos` (CMP-PHOTO-007) · `reminders → training` (API-TRN-007, 014) · `reminders → food` (API-FOOD-001, 008) · `food → nutrition-ai` (API-AI-001, 002) · `progress → training` (API-TRN-007, 011, 015) · `progress → food` (API-FOOD-017, 018) · `progress → body` (API-BODY-004, 005) · `progress → journal` (API-JRN-005) · `shell/app → all`.
