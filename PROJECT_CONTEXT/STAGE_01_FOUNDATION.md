# STAGE 1 — A1 Foundation (DONE)

**Date:** 2026-10-13 · **Package:** A1 (`src/shared/**` + root configs)
**Gates:** `npm run typecheck` PASS · `npm run lint` PASS (0 errors, 0 warnings) · `npx jest` **97 passed / 97 total, 12 suites**

## Files created (all at their contract paths)

### Root configs (A1-owned)
`package.json` · `app.json` · `tsconfig.json` · `babel.config.js` · `jest.config.js` ·
`jest.setup.ts` · `eslint.config.js` · `.prettierrc.json` · `.gitignore`

### Types (verbatim from SHARED_CONTRACT §3.1–3.10)
```
src/shared/types/common.ts profile.ts settings.ts safety.ts training.ts food.ts
                 nutritionAi.ts photos.ts body.ts journal.ts summary.ts backup.ts events.ts
src/shared/errors/AppError.ts       (AppError, isAppError, toAppError)
src/shared/errors/result.ts         (ok, fail)
src/shared/db/types.ts              (SqlParam, Db)
```

### Constants, utils, domain
```
src/shared/constants/text.ts        (CONST-TEXT-001..010 verbatim)
src/shared/constants/settings.ts    (DEFAULT_APP_SETTINGS, DEFAULT_MEAL_REMINDER_TIMES)
src/shared/utils/dates.ts ids.ts units.ts logger.ts
src/shared/domain/safety.ts         (evaluateSymptomReport)
src/shared/domain/activityCalories.ts (estimateExerciseKcal, estimateSessionKcal)
src/shared/navigation/routes.ts     (ROUTES, all 25 keys)
```

### Data layer
```
src/shared/db/migrations.ts         (DDL verbatim, DB_SCHEMA_VERSION=1, DB_TABLES_IN_RESTORE_ORDER)
src/shared/db/database.ts           (getDb, setDbForTesting)  <- only file importing expo-sqlite
src/shared/db/testing/createTestDb.ts (sql.js in-memory Db)
src/shared/data/profileRepository.ts (getProfile, updateProfile, acknowledgeDisclaimer, completeOnboarding)
src/shared/data/referenceWeight.ts   (getReferenceWeightKg)
src/shared/settings/settingsRepository.ts (getSettings, updateSettings, resetAiConsent)
src/shared/settings/SettingsProvider.tsx  (SettingsProvider, useSettings)
```

### Files, platform, events, UI kit
```
src/shared/files/photoStorage.ts    (API-FILE-001..009; only shared file importing expo-file-system)
src/shared/platform/secureStorage.ts (API-SEC-001..003; only file importing expo-secure-store)
src/shared/events/appEvents.ts      (appEvents, useAppEvent)
src/shared/ui/theme.ts Screen.tsx AppText.tsx Button.tsx Card.tsx fields.tsx Chip.tsx
           feedback.tsx confirmAction.ts useFocusLoad.ts PhotoCapture.tsx safetyUi.tsx
           (PhotoCapture.tsx is the only file importing expo-camera)
```

### Tests (12 suites, 97 tests)
```
src/shared/db/__tests__/createTestDb.test.ts
src/shared/utils/__tests__/dates.test.ts units.test.ts logger.test.ts
src/shared/errors/__tests__/AppError.test.ts
src/shared/events/__tests__/appEvents.test.ts
src/shared/data/__tests__/profileRepository.test.ts
src/shared/settings/__tests__/settingsRepository.test.ts
src/shared/domain/__tests__/safety.test.ts activityCalories.test.ts
src/shared/navigation/__tests__/routes.test.ts
src/shared/files/__tests__/photoStorage.test.ts
```

## Registry IDs delivered

CORE 001-007 · DATE 001-011 · UNIT 001-008 · DB 001-004 + CONST-DB-001/002 + TBL-DB-001..012 ·
FILE 001-009 + TYPE-FILE-001/002 · SEC 001-003 + TYPE-SEC-001 · EVT 001 + HOOK-EVT-001 +
EVT-SET/FOOD/TRN/DB · SET 001-007 + CMP-SET-001 + HOOK-SET-001 + TYPE-SET-001..008 ·
SAFE 001 + CMP-SAFE-001/002 + TYPE-SAFE-001..003 · TEXT 001-010 · ACT 001-003 ·
UI 001-015 + TYPE-UI-001 + HOOK-UI-001/002 + API-UI-001 + CMP-UI-001..015 · NAV 001 ·
all TYPE-CORE / TYPE-TRN / TYPE-FOOD / TYPE-AI / TYPE-PHOTO / TYPE-BODY / TYPE-JRN / TYPE-PRG /
TYPE-BKP / TYPE-EVT symbols.

**Consumed from other agents: none.** A1 imports only npm packages and its own files.

## API shapes verified against installed `node_modules` (NOT guessed)

Read the actual `.d.ts` files in this repo before writing the wrappers:

- `expo-sqlite@57.0.4`: `openDatabaseAsync(name)`, `getAllAsync(sql, params[])`,
  `getFirstAsync`, `runAsync -> {changes}`, `withExclusiveTransactionAsync(txn => ...)`,
  `execAsync`. There is **no** `executeAsync`; `execAsync` takes no params.
- `expo-file-system@57.0.7`: object API confirmed — `Paths.document`, `new Directory(...uris)`,
  `dir.create({intermediates, idempotent})`, `dir.createDirectory(name)`, `dir.list()`,
  `dir.exists`, `dir.delete()`, `await dir.move(dest)`, `new File(uri)`, `file.copy(dest)`,
  `file.create({overwrite, intermediates})`, `file.write(str)`, `file.delete()`, `file.exists`,
  `file.size`, `Directory.pickDirectoryAsync(initialUri?)` (returns a **content://** `Directory` on Android).
- `expo-camera@57.0.6`: `useCameraPermissions() -> [PermissionResponse | null, request, get]`,
  `CameraView` with `ref` + `facing`, `takePictureAsync({quality, exif, skipProcessing, base64})`.
- `expo-crypto@57.0.4`: `randomUUID()`.

`UNVERIFIED_EXPO_APIS` remaining (device-only, must be checked on the phone in Stage 8):
`expo-file-system` copy/move between a SAF `content://` directory and app-private storage (A4 backup);
`expo-notifications` DATE trigger timing and same-identifier replacement (A2);
`Directory.pickDirectoryAsync` behaviour on the target Android version.

## Deviations from the pack

### CHANGE-TECH-001 — `@types/react` added to devDependencies (from Stage 0)
Type-only; needed for `tsc` on `.tsx`. Already logged in STAGE_00.

### CHANGE-TECH-002 — `@react-native/jest-preset` added to devDependencies
`jest-expo@57.0.6` refuses to run without it ("The React Native Jest preset that jest-expo relies on
has moved to a separate package"). Without it `npx jest` cannot start at all, so every acceptance test
in the pack would be unrunnable. `"@react-native/jest-preset": "^0.86.3"`, dev only, ships no runtime code.

### NOTE-TECH-003 — `eslint` pinned to `^9.39.0` instead of 10
`eslint-plugin-react` (pulled in by `eslint-config-expo`) crashes on ESLint 10
(`contextOrFilename.getFilename is not a function`) the moment it loads `babel.config.js`.
ESLint 9 runs the same flat config cleanly.

### NOTE-TECH-004 — ESLint rules deviating from the React Compiler defaults
- `@typescript-eslint/array-type` is **off**, because SHARED_CONTRACT §3 type declarations are copied
  verbatim and use `Array<T>`.
- `react-hooks/set-state-in-effect` is disabled at two specific lines, both in hooks whose entire job
  is to load on mount: `SettingsProvider`'s initial load and `useFocusLoad`'s initial load.
  Both carry a one-line reason comment. Every other React rule stays on.
- `react-hooks/refs` forced two real fixes (good): `latest.current` / `loaderRef.current` are now
  written in an effect instead of during render, in `appEvents.ts` and `useFocusLoad.ts`.

### LOCAL-WORKAROUND symbols added inside A1 files (not registry symbols, per CODING_CONVENTIONS §5)
| File | Symbol | Why |
|---|---|---|
| `utils/dates.ts` | `isValidLocalTime`, `localDateFromInstant`, `isRecord` | settings validation and "instant -> local day" for repositories that get an `IsoDateTime` but no `LocalDate` |
| `settings/settingsRepository.ts` | `mergeSettings` (exported for tests) | the deep-merge rule of API-SET-006 |
| `data/profileRepository.ts` | `replaceProfileFields` | A4 restore must write the profile row verbatim |
| `db/database.ts` | `resetDbForTesting` | drops the memoized connection between tests |
| `files/photoStorage.ts` | `assertSafeRelativePath`, `assertValidId`, `ensurePhotoTree` | SEC-10 path safety; all rejection cases are tested |
| `ui/fields.tsx` | none | `isMidnight` was written then removed as dead code |

### Behaviour decisions taken (safest reading of the contract)
- `estimateExerciseKcal` returns null for weight 0 or negative, not just null weight.
- `getReferenceWeightKg` falls back to the profile baseline if the newest weight row has an
  unconvertible unit, instead of skipping it.
- `SymptomChecklist` pain input is a 3-band selector (0-3 / 4-6 / 7-10) with an explicit numeric
  score, because a free 0-10 text field on a phone invites typos. The stored value is still 0-10.
- `useFocusLoad` discards superseded results via a monotonic run id, per HOOK-UI-002.
- `SettingsProvider` renders `null` until settings load, so no screen can read defaults by accident.

## Coverage of the A1 required test list

| Required | Covered by |
|---|---|
| dates: DST boundaries, month/year ends, leap day, invalid dates, `getDayNumber(start,start)=1`, Day 30 = start+29 | `dates.test.ts` — all present and passing |
| units: round trips, formatting, `toKg` unknown unit -> null | `units.test.ts` |
| AppError / toAppError / ok / fail | `AppError.test.ts` |
| logger redaction | `logger.test.ts` (GAT-020) |
| migrations: fresh DB, 12 tables, 4 seeded categories, idempotent rerun, restore order | `createTestDb.test.ts` |
| `createTestDb` smoke + transaction rollback | `createTestDb.test.ts` |
| appEvents: order, unsubscribe, throwing handler isolated | `appEvents.test.ts` |
| profileRepository: defaults, validation, onboarding/disclaimer | `profileRepository.test.ts` |
| settingsRepository: defaults merge, partial update, validation, event payload, resetAiConsent | `settingsRepository.test.ts` |
| referenceWeight: latest weight, lb conversion, baseline fallback, null | `profileRepository.test.ts` |
| evaluateSymptomReport (GAT-010) | `safety.test.ts` |
| activityCalories (GAT-031) | `activityCalories.test.ts` |
| ROUTES encoding + optional params | `routes.test.ts` |
| photoStorage path safety with the file API mocked | `photoStorage.test.ts` |

Not written as tests because the logic is pure UI styling: `Screen`, `AppText`, `Button`, `Card`,
`Chip`, `Segmented`, `fields`, `feedback`, `PhotoCapture`, `safetyUi`, `theme`, `confirmAction`,
`SettingsProvider`. These are covered by Stage 8 device verification (GAT-001..052 manual rows).

## Next

**Stage 2 — A2 Training + Reminders.** Read `docs/architecture/agent-prompts/AGENT_02_PROMPT.md`,
then implement `src/modules/training/**` and `src/modules/reminders/**`.

Hard constraints to remember while writing Stage 2:
- `training` may import `@/modules/photos` **only** (for `ProgressPhotoPromptCard`, CMP-PHOTO-007),
  and only through `src/modules/photos/index.ts` — that module does not exist yet, so defer that import
  until Stage 5 (leave the prompt card out or add it in Stage 5; do NOT import photos internals).
- `reminders` may import `@/modules/training` and `@/modules/food` via their index files only. The food
  module arrives in Stage 3, so either stub the call behind an interface you own or add that part in Stage 3.
- Never auto-modify an exercise (SAF-02, GAT-005).
- Reminder identifiers are fixed: `rem:exercise:<LocalDate>`, `rem:meal:<mealCategoryId>:<LocalDate>`,
  `rem:eod:<LocalDate>`; `syncReminders` cancels every `rem:` id first, so it is idempotent.
- Permission is requested only when the user enables a reminder, never at launch.