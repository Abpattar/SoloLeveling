# STAGE 3 — A3 Food log + reminders completion (DONE)

**Date:** 2026-10-13 · **Packages:** A3 (`src/modules/food/**`) and the deferred A2 reminders files
**Gates:** `npm run typecheck` PASS · `npm run lint` PASS (0 errors, 0 warnings) · `npx jest` **313 passed / 313 total, 23 suites**

## Files created

### Food module
```
src/modules/food/index.ts                        module public surface
src/modules/food/data/mealCategoryRepository.ts  API-FOOD-001..005
src/modules/food/data/foodRows.ts                internal: row mapping + value caps (no import cycle)
src/modules/food/data/foodRepository.ts         API-FOOD-006..014
src/modules/food/domain/nutritionMath.ts         API-FOOD-019/020
src/modules/food/domain/totals.ts               API-FOOD-017/018
src/modules/food/services/estimatorBridge.ts     THE single seam to nutrition-ai
src/modules/food/services/analysisService.ts    API-FOOD-015/016
src/modules/food/screens/FoodLogScreen.tsx       CMP-FOOD-001
src/modules/food/screens/FoodCaptureScreen.tsx   CMP-FOOD-002
src/modules/food/screens/FoodEntryScreen.tsx     CMP-FOOD-003
src/modules/food/screens/MealCategoriesScreen.tsx CMP-FOOD-004
src/modules/food/components/TodayFoodCard.tsx    CMP-FOOD-005
src/modules/food/components/NutritionTargetsSettingsSection.tsx CMP-FOOD-006
src/modules/food/components/EntryCard.tsx        internal
src/modules/food/components/NutritionBadge.tsx   internal
src/modules/food/__tests__/{nutritionMath,totals,estimatorBridge,foodRepository,mealCategoryRepository}.test.ts
```

### Reminders module — Stage-3 debt now paid
```
src/modules/reminders/reminderService.ts         API-REM-001..004
src/modules/reminders/ReminderSettingsSection.tsx CMP-REM-001
src/modules/reminders/index.ts                   module public surface
src/modules/reminders/__tests__/reminderService.test.ts
```

## The key architectural decision — one seam, not stubs

Stage 3 needed `@/modules/nutrition-ai`, which does not exist until Stage 4. Instead of stubbing it,
the whole dependency goes through **one file**: `src/modules/food/services/estimatorBridge.ts`.

- `setEstimatorBridge(bridge | null)` — called once by the shell at bootstrap in Stage 7.
- `getAnalysisAvailabilitySafe()` — returns `{ state: 'disabled' }` when no bridge exists.
- `estimateNutritionFromImageSafe()` — returns `fail('NOT_CONFIGURED')` with no bridge, and converts a
  **thrown** transport error into `fail('NETWORK')` (retryable), so a provider crash can never lose
  a photo or throw out of the entry flow.
- `isEstimatorAttached()` — lets the UI hide retry buttons that cannot work.

Consequence: `analysisService.ts` is **fully implemented and fully tested in Stage 3**. Stage 4 only
writes `nutrition-ai` and calls `setEstimatorBridge` — no food file needs to change.

The second seam is `setBackgroundAnalyzer()` in `foodRepository.ts`: `createFoodEntryFromPhoto` needs
to kick off a background estimate but must not import `analysisService` (that would be a cycle).
`analysisService.ts` registers itself at module load, and `isAnalysisWired()` reports whether that
happened.

## Three real bugs the tests caught (all fixed)

1. **`analyzeFoodEntry` threw when the transport threw.** The bridge now converts a rejected call into
   `fail('NETWORK')`. Covered by `estimatorBridge.test.ts` → "converts a thrown transport error into a
   retryable NETWORK failure".
2. **A `disabled` availability produced the generic error text.** `messageForCode` now maps
   `DISABLED / NO_PROVIDER / NO_CONSENT / NO_API_KEY` to "Photo analysis is off for now. Add values by
   hand instead." Availability states are upper-cased before being passed in.
3. **`processPendingAnalyses` did not stop at a rate limit.** `analyzeFoodEntry` *returns* `pending`
   for `RATE_LIMITED` rather than throwing, so the `break` never fired. Split into an internal
   `analyze()` returning `{ entry, failureCode }`; the public `analyzeFoodEntry` returns just the
   entry, and the batch loop breaks on `failureCode === 'RATE_LIMITED'`.

## Registry IDs delivered

FOOD: API-FOOD-001..020, CMP-FOOD-001..006, EVT-FOOD-001/002 (emitted) ·
REM: API-REM-001..004, HOOK-REM-001, CMP-REM-001, TYPE-REM-001.

## Cross-module edges now in use (all legal, all through module indexes)

`reminders → training` (API-TRN-007/014) · `reminders → food` (API-FOOD-001/008) ·
`food → nutrition-ai` (declared via `estimatorBridge`, wired in Stage 7).

## Tests added (108 new, all passing)

| Suite | Covers |
|---|---|
| `nutritionMath.test.ts` | sum with null macros / null kcal / empty list; scale rounding (kcal int, grams 1 dp), nulls stay null, cap enforcement, ×1 round trip |
| `totals.test.ts` | only ai/confirmed/manual count, null calories → "without values", `bySource` split, meal subtotals with counts, empty day, range inclusive, month/year/leap boundaries, reversed range rejected |
| `estimatorBridge.test.ts` | no bridge → disabled/NOT_CONFIGURED, availability passthrough, availability throws → disabled, failed result passthrough, **thrown transport → retryable NETWORK** |
| `foodRepository.test.ts` | create (relative path only, status for ready/opt-out/off, unknown + archived category rejected, future time rejected, copy failure writes nothing, insert failure deletes the photo, event + background analyzer), list/get, details update + localDate recompute, all five source transitions + conflicts + caps, delete row+file+event, analyze (opt-out gate, manual/confirmed gate, success, notFood, 5 error-code mappings, clarification + meal name passed, never throws), processPending (not-ready no-op, max 5, skip opted-out, stop at rate limit, failed count, restart), round-trip, no cross-DB leakage |
| `mealCategoryRepository.test.ts` | 4 seeded meals, archived hidden, custom appended, name trimming/empty/30-char limit/case-insensitive duplicate, rename, archive blocked for defaults (GAT-048), archived category keeps working entries, reorder + rejection rules, NutritionBadge label mapping (GAT-014) |
| `reminderService.test.ts` | permission state mapping, request, **permission denied → cancels everything**, **sync twice → identical ids (idempotent)**, 7-day window, completed session skips today, logged meal skips today, never throws without a DB, 300 ms debounce on an event burst |

## Gotchas learned (will bite again if forgotten)

1. **`jest.mock` factories cannot reference outer variables** unless the name starts with `mock`.
   All such variables in tests are prefixed `mock*` (`mockScheduled`, `mockPermission`,
   `mockAvailability`, `mockEstimate`, `mockSavedPhotos`…).
2. **Never use a dynamic `await import()` inside test code or a repository function** — it throws
   `A dynamic import callback was invoked without --experimental-vm-modules`. Use a static import.
3. **Do not mock `react-native/Libraries/AppState/AppState`** by path — jest-expo already provides
   `AppState`, and the path mock leaves `AppState` undefined. Leave it alone.
4. **With fake timers, use `await jest.advanceTimersByTimeAsync(ms)`**, not the sync variant, when
   the timer callback starts async work.
5. **Never write repository tests with near-midnight UTC instants** (see the Stage 2 page).

## Test count ledger

| After stage | Suites | Tests |
|---|---|---|
| Stage 1 | 12 | 97 |
| Stage 2 | 17 | 205 |
| Stage 3 | 23 | **313** |

## Next

**Stage 4 — A4 Nutrition AI + Backup/Restore.** Read
`docs/architecture/agent-prompts/AGENT_04_PROMPT.md` and `SHARED_CONTRACT.md` §7 and §8 in full.

Required to keep Stage 4 honest:
- **exactly one** `fetch(` call site in the whole app, inside `src/modules/nutrition-ai/httpClient.ts`,
  with a hard allow-list of `api.groq.com` and `generativelanguage.googleapis.com` (SEC-05, GAT-018).
- **The API key is read only via `getSecret`** from `@/shared/platform/secureStorage` and never
  logged, never put in SQLite, never exported to a backup.
- `getAnalysisAvailability()` must follow the exact order
  `disabled → no_provider → no_consent → no_api_key → ready`.
- **Wire-up you must do:** export `setEstimatorBridge` from `@/modules/nutrition-ai` and call it in
  `src/shell/bootstrap.ts` (Stage 7). Until then the food module behaves as if analysis were off,
  which is the privacy-safe default.

## Known gaps (deliberate, not bugs)

- The food module's "Analyze pending (n)" button is disabled with an explanatory caption until
  `isAnalysisWired()` is true, i.e. until Stage 7 wires the bridge.
- `SessionCompleteScreen` still needs `ProgressPhotoPromptCard` from `@/modules/photos` in Stage 5.