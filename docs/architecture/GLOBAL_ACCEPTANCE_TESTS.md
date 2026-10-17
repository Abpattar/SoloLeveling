# GLOBAL_ACCEPTANCE_TESTS.md

**Version 1.0.** A = automated (Jest, run by `npx jest`), M = manual on device/emulator, S = static check (OpenCode script). "Owner" writes the automated test. Results are recorded by OpenCode in `FINAL_INTEGRATION_REPORT.md`; untested items are reported as NOT VERIFIED, never assumed.

| ID | Type | Scenario → expected result | Owner | Reqs |
|---|---|---|---|---|
| GAT-001 | M/S | Fresh install in airplane mode: app launches, onboarding and all non-AI features work; no hosted backend configured | A7/OpenCode | PRD-001 |
| GAT-002 | A/M | First launch shows disclaimer; "I understand" required; profile (height, units, optional baseline) saved; Journey 1 created with start date ≤ today; then Today screen | A7 | SAF-01, MEAS-001 |
| GAT-003 | A/M | Create, edit, reorder, pause, delete exercises; reload app; list persists; validation rejects empty name / no reps+duration | A2 | EXR-001 |
| GAT-004 | A/M | Session: one exercise at a time; set counter; rest timer; pause/resume; skip; stop; completion saves session with per-exercise sets/reps/active seconds; appears in history/detail and Today card | A2 | SES-001/002/005/006, ACT-001 |
| GAT-005 | A | After saving sessions (including with symptoms) no exercise field (sets/reps/duration/rest/schedule/status) changes; no code path auto-modifies exercises | A2 | EXR-002, PRD-004 |
| GAT-006 | A/M | Enable exercise reminder: permission requested at enable time; `syncReminders` twice yields identical identifier set (no duplicates); 7-day window; meal and end-of-day reminders likewise | A2 | EXR-003, REM-001/003 |
| GAT-007 | A | Exercise completed today → today's exercise reminder not scheduled; breakfast logged → today's breakfast prompt skipped | A2 | REM-003 |
| GAT-008 | M | Notification permission denied: toggles remain off, explanation + open-settings shown; battery note visible | A2 | REM-002, REL-001 |
| GAT-009 | A | Ticking any symptom flag at session end shows `SafetyAdviceCard` with exact fixed text; exercise plan unchanged | A1/A2 | SES-003/004 |
| GAT-010 | A | `evaluateSymptomReport`: no flags + pain 7 + alert level null → null; pain ≥ alert level → advice; pain < level → null | A1 | SES-004 |
| GAT-011 | A | Journal entry with symptom flags shows advice; entry saved regardless | A6 | JRN-001 |
| GAT-012 | S | Layering script: `fetch(`/network APIs only under `src/modules/nutrition-ai/`; no analytics/crash packages in `package.json`; only approved dependencies | OpenCode | PRIV-001, PRD-006 |
| GAT-013 | A | Default settings: saving a food entry performs zero network calls (mock `fetch` asserts not called) | A3/A4 | FOOD-003/009 |
| GAT-014 | A/M | AI entry shows "AI estimate" badge + disclaimer; after confirm shows "Confirmed"; manual shows "Manual"; unknown shows "Unknown"; kcal integers; never "exact" wording | A3 | FOOD-010, NUT-003 |
| GAT-015 | A | Analysis availability sequence disabled → no_provider → no_consent → no_api_key → ready; changing provider or disclosure version voids consent; enabling UI shows provider disclosure text first | A4 | FOOD-012, PRIV-003 |
| GAT-016 | A | Entry with `analysisOptOut` never triggers a request: `analyzeFoodEntry` throws `CONSENT_REQUIRED` (A3) and estimator is not called; `processPendingAnalyses` skips it | A3 | FOOD-012 |
| GAT-017 | A | `estimateNutritionFromImage` with a `progress/…` or non-private URI returns `VALIDATION` and makes no request | A4 | PRD-003 |
| GAT-018 | A | HTTP client refuses hosts other than `api.groq.com` and `generativelanguage.googleapis.com` | A4 | PRD-003 |
| GAT-019 | A/S | API key written/read only via `secureStorage`; absent from SQLite dump, backup folder, logs | A4/A1 | PRIV-002 |
| GAT-020 | A | `logger` redacts `uri`, `path`, `image*`, `base64`, `apiKey`, `note*` keys | A1 | PRIV-001 |
| GAT-021 | A/M | Before Day 30 `listProgressPhotos` returns `visible:false`, `imageUri:null` for all photos; UI shows only "N photos locked until <date>" with no thumbnail | A5 | PHO-004 |
| GAT-022 | A | Unlock mapping: day 5→30, 30→30, 31→60, 60→60, 61→90, 90→90, 91→visible; locked until date or early unlock | A5 | PHO-004/008 |
| GAT-023 | A/M | `unlockMilestoneEarly` without `confirmed:true` → VALIDATION; unlocking 60 before 30 → VALIDATION; UI asks confirmation | A5 | PHO-006/008 |
| GAT-024 | A | Day math across DST change and timezone offsets: Day 30 = start + 29 calendar days; `getDayNumber` for start date = 1 | A1/A5 | PHO-001 |
| GAT-025 | A/M | Start-date edit: warning shown; future date rejected; date that would put a photo before Day 1 rejected; unlock dates recomputed; early unlocks kept | A5 | PHO-008 |
| GAT-026 | A/M | `startNextJourney` rejected before Day 90 unlocked; afterwards Journey 1 → completed, Journey 2 active starting today with locks restarting; Journey 1 photos stay unlocked and viewable | A5 | PHO-009 |
| GAT-027 | M/S | Photos live under app-private dir with opaque names; not visible in device gallery; camera capture has no EXIF | A1/A5 | PHO-003, FOOD-002 |
| GAT-028 | M | `LOCK_NOTE_TEXT` visible on Photos screen and Settings About; photo delete/export explained | A5/A7 | PHO-007/008 |
| GAT-029 | A/M | Workout calorie text uses `WORKOUT_KCAL_LABEL`; toggle off hides it everywhere (session complete, history, daily summary, progress) | A2/A6/A7 | ACT-002/004 |
| GAT-030 | A | `DailySummary.estimatedWorkoutKcal` never added to/subtracted from nutrition totals; no "net" or "TDEE" strings in code | A6 | ACT-003 |
| GAT-031 | A | `estimateExerciseKcal` returns null without weight or intensity or activeSeconds ≤ 0; formula `round(MET×kg×s/3600)` with contract MET values | A1/A2 | ACT-002/005 |
| GAT-032 | A/M | At unlocked milestones comparisons show baseline vs target; missing photos give clear empty states; timeline shows only exact-day visible photos | A5 | PHO-005 |
| GAT-033 | M | Backup screen and pre-restore dialog show `BACKUP_PRIVACY_WARNING` | A4 | DATA-002/003 |
| GAT-034 | A/M | Export creates `RecoveryFitness-Backup-<ts>/` with manifest (row counts, photoCount) + data.json + photos; counts match DB | A4 | DATA-002/003 |
| GAT-035 | A/M | Restore needs `confirmed:true` + UI confirmation; replaces data; original dates, journeys, early unlocks and lock states preserved; AI consent reset; `data.restored` emitted | A4 | DATA-003 |
| GAT-036 | A | Corrupt/mismatched backup (bad manifest, missing photo, schema mismatch) → `Result` failure, existing data untouched (DB and photos) | A4 | DATA-003 |
| GAT-037 | A/M | Airplane mode: take food photo, pick category, save without any search; entry has status `not_requested`; later enter manual values → source `manual` | A3 | FOOD-001/002/005/008 |
| GAT-038 | A/M | AI failure (offline → `pending`; provider error → `failed`) never loses the photo; retry works; clarification question flows into re-estimate; portion scaling ×0.5/×1.5 rescales values; edit/confirm/unknown work; prompt contains Indian/South Indian guidance and household units | A3/A4 | FOOD-004/006/008/011, TECH-004 |
| GAT-039 | A | Daily totals sum ai/confirmed/manual entries only, bySource and meal subtotals correct, unknown entries counted separately; optional targets shown but never recommended | A3 | FOOD-007, NUT-002/004 |
| GAT-040 | S | `app.json` has `android.allowBackup: false` and camera plugin without audio permission | A1 | PRIV-001 |
| GAT-041 | A/M | Height/units in profile; weight entries (kg or lb); waist/thigh/custom entries; change-from-baseline and weekly/monthly figures computed | A6 | MEAS-001..004 |
| GAT-042 | A/M | Charts render with 0, 1, many points without crashing; weight chart shows 7-day average; consistency chart by week | A6 | MEAS-002, FOOD-007 |
| GAT-043 | A/M | Delete progress/food photo removes DB row and file; export allowed only for visible progress photos (`LOCKED` otherwise) | A5/A3 | PHO-007, TECH-004 |
| GAT-044 | M | Force-stop and relaunch: all entities from every module persist; locked photos stay locked; pending analyses still pending | OpenCode | DATA-004 |
| GAT-045 | A/M | `npx tsc --noEmit`, lint, `npx jest` pass; `npx expo-doctor` clean or explained; dev APK builds and installs on a phone via the MANUAL_ASSEMBLY_GUIDE | OpenCode | TECH-001/003 |
| GAT-046 | M | README covers build/run, permissions, local storage, optional API configuration, privacy trade-offs, known limitations | A7/OpenCode | TECH-002 |
| GAT-047 | A/M | Journal entries create/edit/delete/list; scores 0–10 validated; copy states tracking only | A6 | JRN-001 |
| GAT-048 | A | Custom meal category create/rename/archive; default categories cannot be archived; several entries per category per day | A3 | FOOD-001 |
| GAT-049 | A | `getDailySummary` returns nutrition, targets, sessions, scheduled count, weight, measurements, journal for the date; empty day returns zeros/nulls | A6 | NUT-001 |
| GAT-050 | S | `scripts/check-contract.mjs` passes: layering rules, registry symbols exist and are exported from the right file/index, no duplicate declarations of shared types, route files match CONTRACT §4 | OpenCode | all |
| GAT-051 | A | Route test: every route file listed in CONTRACT §4 exists, renders the specified component with specified props | A7 | NAV-001 |
| GAT-052 | A/M | After a completed session the progress-photo prompt card appears; "Skip" dismisses it and session completion is unaffected | A5/A2 | PHO-002 |
