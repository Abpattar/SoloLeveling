# STAGE 06 — A6 Body measurements, Recovery journal, Progress charts, Daily summary

Status: **DONE** — typecheck PASS, lint PASS (0 warnings), **635/635 tests in 40 suites** (99 new).

Scope: `src/modules/body/**`, `src/modules/journal/**`, `src/modules/progress/**`, plus one shared
UI addition (the SVG charts) — see Deviations.

## Files created

### Body (`src/modules/body/**`)

| Path | Registry IDs | What it does |
|---|---|---|
| `data/measurementRepository.ts` | API-BODY-001..005 | CRUD on `measurements`. Validation: `value > 0` and finite; `unit` 1–12 chars; weight must be 20–400 kg after `toKg` (an unknown weight unit is a `VALIDATION` error, because it cannot be checked); `custom` needs a 1–40 char `customLabel` and other types drop it; `measuredAt` defaults to now and is rejected in the future; `localDate` is derived from the instant in local time. `listMeasurements` is date-ascending with type/date filters. `getWeightSeriesKg` returns **one point per date** (the latest `measuredAt` that day) converted with `toKg`, skipping values it cannot convert. |
| `domain/weightSeries.ts` | internal | `movingAverage(points, windowDays = 7)` (trailing, by date not by index, so a gap lowers the average instead of shifting it), `changeFromBaseline(points, baselineKg)`, `weeklyAverages` (`YYYY-Www`, ISO weeks), `monthlyAverages` (`YYYY-MM`). |
| `components/MeasurementForm.tsx` | internal | Add/edit one measurement. Weight uses the profile unit system; `custom` requires a label; date capped at today; optional note. |
| `screens/MeasurementsScreen.tsx` | CMP-BODY-001 | Read-only height/units summary from `getProfile`, form, filterable list newest-first with edit + confirm-delete, weight `LineChart` with the 7-day average and the "Day-to-day changes are normal" caption, change-from-baseline, weekly and monthly average rows, and the caption that measurements and photos do not prove muscle recovery. |
| `index.ts` | — | Module surface only. |

### Journal (`src/modules/journal/**`)

| Path | Registry IDs | What it does |
|---|---|---|
| `data/journalRepository.ts` | API-JRN-001..006 | Create/update/delete/list/get. **At least one field** must be set. Pain and stiffness are integers 0–10; swelling is one of `none/mild/moderate/significant`; notes ≤ 4000 chars and blank becomes `null`; a future date is rejected. `listJournalEntries` is newest-first with date filters and a limit; `getJournalEntriesForDate` returns one day. |
| `components/JournalEntryForm.tsx` | internal | The fields. Field state is initialised once from the loaded entry, so there is no effect and no cascading render. Renders `SymptomChecklist` and shows `SafetyAdviceCard` the moment a warning flag is ticked or pain reaches the user's own alert level. Saving stays available while the advice is shown. |
| `screens/JournalScreen.tsx` | CMP-JRN-001 | List with a score summary line. Header says "Tracking only — not a diagnosis". |
| `screens/JournalEntryScreen.tsx` | CMP-JRN-002 | New or existing entry: loads, handles not-found, saves, deletes with confirmation. |
| `index.ts` | — | Module surface only. |

### Progress (`src/modules/progress/**`)

| Path | Registry IDs | What it does |
|---|---|---|
| `services/dailySummary.ts` | API-PRG-001 | Assembles one day on read: nutrition totals, targets, scheduled/completed counts, session list, `estimatedWorkoutKcal`, that day's weight in kg, measurements and journal entries. Workout calories are a separate field and are **never** added to intake. Plus `getProgressInputs(from, to)` (LOCAL-WORKAROUND) for the weight series and completed counts of a range. |
| `domain/trends.ts` | internal | `weeklyNutritionAverages` (averages only days that actually have values) and `exerciseConsistencyByWeek` (sessions and days-with-a-session per ISO week, out-of-range counts ignored). |
| `charts/*` | internal | Moved — see Deviations 1. Now `src/shared/ui/charts/LineChart.tsx` and `BarChart.tsx`. |
| `screens/ProgressScreen.tsx` | CMP-PRG-001 | 7/30/90 day ranges, weight trend + 7-day average, daily calories with an optional target line, daily protein, completed sessions per week, other measurements, `ESTIMATE_DISCLAIMER_TEXT` under the nutrition charts, and links to Measurements, Journal, Session history and Today's summary. |
| `screens/DailySummaryScreen.tsx` | internal | One day against the contract `DailySummary` type. Workout calories on their own line, never summed with food. |
| `index.ts` | — | Module surface: `getDailySummary`, `getProgressInputs`, `exerciseConsistencyByWeek`, `weeklyNutritionAverages`, `ProgressScreen`. |

## Public exports added

| Symbol | ID | Exported from |
|---|---|---|
| `addMeasurement` / `updateMeasurement` / `deleteMeasurement` / `listMeasurements` / `getWeightSeriesKg` | API-BODY-001..005 | `@/modules/body` |
| `MeasurementsScreen` | CMP-BODY-001 | `@/modules/body` |
| `movingAverage` / `changeFromBaseline` / `weeklyAverages` / `monthlyAverages` | internal | `@/modules/body` (LOCAL-WORKAROUND: the Progress tab charts them) |
| `createJournalEntry` / `updateJournalEntry` / `deleteJournalEntry` / `listJournalEntries` / `getJournalEntriesForDate` / `getJournalEntry` | API-JRN-001..006 | `@/modules/journal` |
| `JournalScreen` / `JournalEntryScreen` | CMP-JRN-001/002 | `@/modules/journal` |
| `getDailySummary` / `getProgressInputs` | API-PRG-001 / internal | `@/modules/progress` |
| `exerciseConsistencyByWeek` / `weeklyNutritionAverages` | internal | `@/modules/progress` |
| `ProgressScreen` | CMP-PRG-001 | `@/modules/progress` |
| `isoWeekKey` | internal | `@/shared/utils/dates` (see Deviations 2) |

## Imported IDs

- `@/shared/data/profileRepository` API-SET-001, `@/shared/utils/units` API-UNIT-005/006/007/008,
  `@/shared/ui/confirmAction` API-UI-001, `@/shared/domain/safety` API-SAFE-001,
  `@/shared/ui/safetyUi` CMP-SAFE-001/002, `@/shared/settings/SettingsProvider` HOOK-SET-001,
  `@/shared/constants/text` CONST-TEXT-004/009, `@/shared/navigation/routes` CONST-NAV-001.
- `@/modules/training` API-TRN-007/011/015, `@/modules/food` API-FOOD-017/018, `@/modules/body`
  API-BODY-004/005, `@/modules/journal` API-JRN-005 — all through module indexes.

## Test count ledger

| After stage | Suites | Tests |
|---|---|---|
| Stage 5 | 33 | 536 |
| Stage 6 | 40 | **635** |

| Suite | Tests | Covers |
|---|---|---|
| `body/__tests__/measurementRepository.test.ts` | 23 | Full validation matrix (non-positive, non-finite, empty unit, >12-char unit, weight outside 20–400 kg, unknown weight unit, missing/over-long `customLabel`, future `measuredAt`, malformed date), default `measuredAt`, date-ascending list, type and range filters, series = latest per date in kg, lb conversion, range honoured, empty series, update, delete, unknown ids. |
| `body/__tests__/weightSeries.test.ts` | 16 | Trailing average windows incl. date gaps and a 6-day-old point, flat series, default window, baseline from profile vs first point, zero change, null cases, ISO week keys across a year boundary (2025-12-29 → `2026-W01`), month keys. |
| `journal/__tests__/journalRepository.test.ts` | 21 | At-least-one-field rule, single-flag and note-only entries, score bounds and integers, unknown swelling, note length, blank→null, future and malformed dates, newest-first order, range filter, limit, per-date query, update, delete, unknown ids. |
| `journal/__tests__/JournalEntryForm.test.tsx` | 8 | GAT-011: advice card on a ticked flag, on pain ≥ the alert level, not below it, not when no alert level is set; saving stays available; existing values render; delete only for a stored entry. |
| `progress/__tests__/trends.test.ts` | 8 | Weekly averages ignore empty days, ISO keys across a year, consistency counts, out-of-range counts ignored, ascending order, empty range. |
| `progress/__tests__/dailySummary.test.ts` | 11 | Malformed date, empty day zeros/nulls, full day assembly, lb→kg, completed-only kcal sum, no kcal when none recorded, **GAT-030 workout kcal never added to nutrition**, non-weight measurements, latest weight of the day, weight from another day ignored. `@/modules/training` and `@/modules/food` are mocked at the module boundary. |
| `shared/ui/charts/__tests__/charts.test.tsx` | 13 | GAT-042: 0 / 1 / many points, flat series, negative values, all-zero bars, non-finite values, average series + reference lines, accessibility label on both charts. |

## Commands and real results

```
npm run typecheck   -> silent (PASS)
npm run lint        -> silent (PASS, 0 warnings)
npx jest            -> 40 suites, 635 tests, 0 failures
npm run contract-check -> NOT RUN: scripts/check-contract.mjs does not exist yet (Stage 8 work)
```

Extra dev dependency added: `test-renderer@1.3.0` — the renderer `@testing-library/react-native@14`
requires. The repo had no component tests before Stage 6, so it was never installed. `react-test-renderer`
was installed first and turned out to be the wrong package; it was uninstalled again. Dev-only, no app
impact. `src/shared/ui/charts/__tests__/charts.test.tsx` is the first component test in the repo, so it
also documents the working pattern: `await render(...)` (RNTL 14's `render` is async) and queries via the
exported `screen`.

## Deviations / local decisions

1. **The SVG charts moved from `progress/charts/` to `src/shared/ui/charts/`.**
   `AGENT_06_PROMPT.md` §3 puts `LineChart.tsx`/`BarChart.tsx` in `progress/charts/`, and CMP-BODY-001
   also needs a weight chart. CONTRACT §2.8 allows `progress → body` but never `body → progress`, so
   the prompt's own layout needs an illegal edge (and a `body ↔ progress` cycle). The charts are
   dependency-free presentational components, so they live in shared UI and both modules reach them by
   deep path, which is rule-12 compliant. They are deliberately **not** re-exported from the progress
   index, because that would recreate the illegal edge. Everything else about them follows the prompt:
   `react-native-svg` only, min/max auto, optional average series and reference lines, accessible
   summary, safe with 0/1/many points.
2. **`isoWeekKey` was added to `@/shared/utils/dates`.** Weight weekly averages and exercise
   consistency both need it; one implementation in shared date maths beats two copies in two modules.
   `src/shared/**` was otherwise untouched.
3. **`JournalEntryForm` is a separate file** from `JournalEntryScreen` so the form can mount with
   `key={entryId}` and take initial values as props. Seeding form state from loaded data in an effect
   tripped the `react-hooks/set-state-in-effect` lint rule.
4. **`safety.painAlertLevel` is `number | null`**, so the journal form passes it straight through to
   `evaluateSymptomReport`. No alert level set means no advice card unless a warning flag is ticked —
   the app never picks a threshold.
5. **`exerciseConsistencyByWeek` lists only weeks that have sessions.** A fully empty range returns
   `[]` and `ProgressScreen` shows "No completed sessions in this range." instead of a wall of zero
   bars. Zero-fill would need `daysInRange`, which was removed as dead code.
6. **`changeFromBaseline` takes an optional `referenceDate`** (defaults to the latest point) so the
   Daily summary can compare against a specific day if A7 needs it.

## Safety confirmations

- No "net calories", "TDEE", deficit or surplus string anywhere in the three modules (grepped).
- No diagnosis, staging, progression, prescription or outcome language. The only claims are
  arithmetic and the fixed texts from `CONST-TEXT-*`.
- Workout calories stay a separate figure everywhere: `DailySummary.estimatedWorkoutKcal`, its own
  card in `DailySummaryScreen`, and the sentence "Workout calories stay separate from food calories.
  They are not added together."
- Charts handle empty data (`No data yet.`), a single point, a flat series, negative values,
  all-zero bars and non-finite values without dividing by zero or throwing.
- Measurements and photos do not prove muscle recovery (SAF-07 caption on `MeasurementsScreen`).

## Next

**Stage 7 — A7 Shell.** Read `docs/architecture/agent-prompts/AGENT_07_PROMPT.md`.

Constraints to remember:
- Wire the AI bridge in `src/shell/bootstrap.ts`:
  `setEstimatorBridge({ getAnalysisAvailability, estimateNutritionFromImage })`.
- Route files must call the screens this stage exported: `MeasurementsScreen` (CMP-BODY-001),
  `JournalScreen` / `JournalEntryScreen` (CMP-JRN-001/002), `ProgressScreen` (CMP-PRG-001), plus a
  `DailySummaryScreen` route using `ROUTES.dailySummary(localDate)`.
- Journal routes must pass `entryId`: `null` for a new entry.
- Keep AI off by default and never send progress photos.
- Stage 8 writes `scripts/check-contract.mjs`; `npm run contract-check` currently fails because that
  file does not exist yet.