# STAGE 2 — A2 Training + Reminders (PARTIALLY DONE — reminders service deferred to Stage 3)

**Date:** 2026-10-13 · **Package:** A2 (`src/modules/training/**`, `src/modules/reminders/**`)
**Gates:** `npm run typecheck` PASS · `npm run lint` PASS (0 errors, 0 warnings) · `npx jest` **205 passed / 205 total, 17 suites**

## What is DONE

### Training module — complete
```
src/modules/training/index.ts                    (module public surface)
src/modules/training/domain/validation.ts       validateExerciseInput / validateExercisePatch
src/modules/training/domain/sessionMachine.ts   pure reducer + buildResults
src/modules/training/data/exerciseRepository.ts API-TRN-001..007
src/modules/training/data/sessionRepository.ts  API-TRN-008..015
src/modules/training/hooks/useSessionRunner.ts   ticker + haptics + keep-awake + AppState
src/modules/training/screens/ExerciseListScreen.tsx
src/modules/training/screens/ExerciseEditorScreen.tsx
src/modules/training/screens/SessionRunScreen.tsx
src/modules/training/screens/SessionCompleteScreen.tsx
src/modules/training/screens/SessionHistoryScreen.tsx
src/modules/training/screens/SessionDetailScreen.tsx
src/modules/training/components/TodayExerciseCard.tsx
src/modules/training/components/ExerciseForm.tsx
src/modules/training/__tests__/{exerciseRepository,sessionRepository,sessionMachine,validation}.test.ts
```

### Reminders module — partially done (pure layers only)
```
src/modules/reminders/types.ts             TYPE-REM-001 + internal PlannedReminder
src/modules/reminders/scheduler.ts         pure planReminders()  ← fully tested
src/modules/reminders/notifications.ts     ONLY expo-notifications importer
src/modules/reminders/useReminderNotificationRouting.ts
src/modules/reminders/__tests__/scheduler.test.ts
```

## What is NOT done yet, and exactly why

Three reminders files are deliberately missing because they need a module that does not exist yet:

| Missing file | Blocked on | Needed imports |
|---|---|---|
| `reminders/reminderService.ts` | Stage 3 (food) | `listMealCategories`, `listFoodEntriesForDate` from `@/modules/food` |
| `reminders/ReminderSettingsSection.tsx` | Stage 3 (food) | `listMealCategories` from `@/modules/food` |
| `reminders/index.ts` | the two files above | re-exports API-REM-001..004, HOOK-REM-001, CMP-REM-001 |

**Do not create them with stubs.** Write them at the end of Stage 3, when `@/modules/food` exports
its index. `scheduler.ts` and `notifications.ts` are already complete and tested, so those files
only contain the wiring:
1. `initializeReminders()` — set handler, ensure channel, subscribe to
   `settings.changed` / `food.entry.saved` / `food.entry.deleted` / `session.saved` /
   `exercises.changed` / `data.restored`, AppState `active`, then one initial `syncReminders()`.
2. `syncReminders()` — if permission is not `granted`, cancel all `rem:` and return; else gather
   settings, meal categories, `listExercisesScheduledFor` per date in the window,
   `getSessionDayStatus(today)`, `listFoodEntriesForDate(today)`, run `planReminders`, cancel all
   `rem:`, schedule each. Wrap everything in try/catch + `logger.warn`; never throw.
3. Debounce event-triggered syncs at 300 ms.
4. `getNotificationPermissionState()` / `requestNotificationPermission()` delegate to `notifications.ts`.
5. `ReminderSettingsSection` — toggles + `TimeField`s, permission requested **only** when the user
   enables something, denial leaves the toggle off and shows the explanation + "Open settings",
   always shows `BATTERY_OPTIMISATION_NOTE`, saves via `updateSettings({ reminders })`.

## One Stage-5 edit is already known about

`SessionCompleteScreen` must render `<ProgressPhotoPromptCard sessionId>` after the reflection is
saved (CMP-PHOTO-007, REQ-PHO-002, GAT-052). That component lives in `@/modules/photos`, which
arrives in Stage 5. When you get there, add to `SessionCompleteScreen.tsx`:

```ts
// CONTRACT: CMP-PHOTO-007 (A5) — post-session photo prompt, skippable, never blocks completion
import { ProgressPhotoPromptCard } from '@/modules/photos';
```
and render it after the Save button. Until then session completion works without the prompt.

## Registry IDs delivered

TRN: API-TRN-001..015, CMP-TRN-001..007 · REM: TYPE-REM-001 (HOOK-REM-001 logic written but not
exported yet — no `index.ts`).

## Consumed from A1 (all by deep path, with `// CONTRACT:` lines)
TYPE-CORE-*, TYPE-TRN-001..011, TYPE-SAFE-*, CLS-CORE-001, API-CORE-005/006/007,
API-DATE-001..011, API-DB-001/003, API-DB-004 (tests), API-EVT-001, API-SET-005/006, HOOK-SET-001,
API-SAFE-001, CMP-SAFE-001/002, CONST-SET-002, CONST-TEXT-006, API-ACT-001..003, API-UNIT-*,
CMP-UI-001..015, HOOK-UI-001/002, API-UI-001, CONST-NAV-001.
**No cross-module imports exist yet** — `training → photos` and `reminders → food|training` are the
only legal module edges and they are deferred to Stages 3 and 5.

## Design decisions taken

1. **`getSessionDayStatus` does not import `listExercisesScheduledFor` dynamically.** A static
   import from `exerciseRepository` is used instead; a dynamic `import()` inside the function works
   at runtime but breaks under Jest without `--experimental-vm-modules`.
2. **Timezone-safe test instants.** Repository tests use `12:00:00.000Z` instants, never
   `05:00:00.000Z`. A UTC instant near midnight maps to different local dates depending on the
   machine's timezone; noon is stable for every offset within ±11 hours. This is why
   "derives localDate from startedAt" asserts `2026-10-12` from a `2026-10-12T12:00Z` start with a
   `2026-10-13T12:00Z` end.
3. **SKIP_EXERCISE jumps the whole exercise.** `advance()` moves one *set* at a time, so skipping an
   exercise sets `setIndex = exercise.sets` first; otherwise skipping a 3-set exercise would only
   skip its first set. Result statuses are derived solely in `buildResults` from `completedSets`
   vs `plannedSets`, so there is exactly one place that decides completed / partial / skipped.
4. **Result statuses are never written by the machine.** `progress[].status` exists only for
   internal bookkeeping; `buildResults` recomputes it, which removes a whole class of drift bugs.
5. **SessionRunScreen plans "today's scheduled exercises, else every active exercise".** This keeps
   the Start button usable on a rest day without inventing a plan.
6. **`SessionRunScreen` saves on `phase === 'finished'`.** `status` is `completed` only when the
   machine reached the end of the list; `STOP` saves with status `stopped`. If nothing at all was
   completed, `buildInput` returns `null` and the screen goes back without creating an empty row.
7. **Apostrophes in JSX text use `’`** because `react/no-unescaped-entities` is an error. Reminder
   body strings in `scheduler.ts` use a plain `'` because they are not JSX.
8. **`useSessionRunner` vibrate calls are guarded** in try/catch — a device without a vibrator must
   not break a session.

## Tests added (88 new, all passing)

| Suite | Covers |
|---|---|
| `validation.test.ts` | name 1–80, sets 1–50, reps 1–1000, duration 1–7200, "at least one of reps/duration", rest 0–900, weekday dedupe + sort + range, 2000-char text cap, intensity enum, patch-merge semantics |
| `exerciseRepository.test.ts` | CRUD, sortOrder append, paused filtering, weekday matching, reorder rules (partial/duplicate/unknown all rejected and nothing changes), delete keeps the session name snapshot and NULLs `exercise_id`, `exercises.changed` fires once per mutation, full round-trip, no cross-connection leakage |
| `sessionRepository.test.ts` | round-trip with results, `localDate` from `startedAt`, ≥1 result, end-before-start, negative counts, unknown statuses, **rollback writes nothing**, `session.saved` emitted once post-commit and not at all on rollback, kcal null / baseline / latest-measurement / no-intensity, list filters + limit, reflection bounds with no write on failure, **GAT-005 exercise untouched**, delete cascade, day status, counts by date |
| `sessionMachine.test.ts` | rep flow, duration auto-complete, rest only between sets/exercises, skip, stop, pause/resume freezing both the countdown and active time, wall-clock delta accounting, backwards clock jump, `buildResults` ordering/snapshots/clamps, **GAT-005 no mutation of the plan** |
| `scheduler.test.ts` | 7-day rolling window, custom window, past times dropped, disabled types absent, completed session skips today, logged category skips today, identifier shapes + uniqueness + sort order, idempotency, routes, all four end-of-day body variants, all-off defaults |

## Test count ledger

| After stage | Suites | Tests |
|---|---|---|
| Stage 1 | 12 | 97 |
| Stage 2 | 17 | 205 |

## Next

**Stage 3 — A3 Food log** (`src/modules/food/**`), then finish the reminders service and
`reminders/index.ts` at the end of that stage. Read
`docs/architecture/agent-prompts/AGENT_03_PROMPT.md` and `SHARED_CONTRACT.md` §7/§8.

Constraints to remember:
- `food → nutrition-ai` is a legal edge, but nutrition-ai is Stage 4. Write `analysisService.ts`
  in Stage 4 and keep Stage 3 to the local-only path, exactly like reminders.
- The photo must be copied into private storage by `savePhotoFromUri` before the DB row is written,
  and the DB insert must be removed if the copy fails (ERROR_HANDLING §3.3).
- `nutritionSource` starts as `none`; the AI only ever writes `ai_estimate` until the user confirms.
- Nothing may be sent anywhere while `ai.externalAnalysisEnabled === false` (GAT-013).