# MASTER_ARCHITECTURE.md

**Version 1.0 · 2026-10-11.** Includes the module dependency map (section 4). Read with SHARED_CONTRACT.md.

## 1. Product in one paragraph
A personal, Android-first, local-first app (React Native + Expo, SQLite, no backend, no accounts) to run the user's own clinician-approved exercise routine with reminders, log meals by photo with optional clearly-approximate AI nutrition estimates, track weight/measurements and a symptom journal, take post-session progress photos that stay locked until Day 30/60/90 (repeatable 90-day "Journeys"), see simple progress charts, and export/restore everything. It never diagnoses, prescribes, or progresses rehab.

## 2. Brief vs. user decisions (traceability)
Source of truth order: user's answers (Phase 0 replies) > brief PDF > architect defaults. User-added or user-changed items are tagged `[USER]` in MASTER_REQUIREMENTS.md. Key user decisions: Indian/South Indian food + household portions; external AI disabled until the user approves provider/cost/privacy; one global opt-in + per-photo opt-out; symptom checklist with optional 0–10 pain and no invented clinical thresholds; photo-lock rules + **Journeys 1, 2, 3…**; unencrypted backups incl. locked photos with warning; light/moderate/vigorous workout calorie estimates (hideable); dev APK sideloading; Ubuntu 24.04 laptop; 4–5 agents (we use 7 — see §6).

## 3. Layers
```
src/app/**            expo-router route files (thin)                      [A7]
src/shell/**          composition root: providers, Today, Settings, Onboarding, bootstrap [A7]
src/modules/<name>/** feature modules, public API = index.ts             [A2..A6]
src/shared/**         base layer: types, constants, db, files, events, settings, safety, ui, utils [A1]
```
Rules: shared never imports upward; modules talk to each other only along the edges below; everything else flows through SQLite, `appEvents`, or shared services.

## 4. Module dependency map
```
                         ┌──────────── shell/app (A7) ───────────┐
                         ▼         imports every module index      ▼
 reminders(A2) ──► training(A2) ──► photos(A5)        progress(A6) ──► training, food, body, journal
      │                                                   
      └────────► food(A3) ──► nutrition-ai(A4)          backup(A4)   body(A6)   journal(A6)   (no module imports)
 All modules ──► shared (A1)
```
Edges (exhaustive): `training→photos`, `reminders→training`, `reminders→food`, `food→nutrition-ai`, `progress→training|food|body|journal`. **No cycles**; circular-risk points were removed by design: (a) food saves results itself, `nutrition-ai` never touches food tables; (b) reminders react to events instead of being called by food/training; (c) calorie math and latest-weight lookup live in shared so `training` need not import `body`; (d) journeys live in `photos`, and only the shell and `training` (via one component) reach it.

## 5. Key design decisions
| Topic | Decision | Why |
|---|---|---|
| Parallel safety | One shared contract + registry; Foundation (A1) owns all shared types verbatim, DB schema, UI kit, camera component | Consumers never invent interfaces |
| Data access | Only A1 imports `expo-sqlite`; repositories use the `Db` interface (testable with `sql.js`) | Isolates the Expo API surface that cannot be verified by blind agents |
| Navigation | `expo-router`; route files are one-screen wrappers with fixed props (CONTRACT §4) | Agents write screens without knowing the router layout |
| Derived data | Day numbers, lock state, totals, summaries computed on read | Editing the start date or an entry can never leave stale caches |
| Journeys | `journeys` table; Journey 1 from onboarding; next journey on user action once Day 90 is unlocked; photos keep their journey | Implements the user's "Journey 1/2/3" request while keeping "after Day 90 photos are visible immediately" if no new journey is started |
| Photo lock | Enforced in the data layer: locked photos return `imageUri: null` (no path/thumbnail leak); early unlock needs `confirmed: true` | UI bugs cannot reveal photos |
| AI privacy | Network code only in `nutrition-ai`; consent in settings + key in secure store; image must be under `food/`; downscaled, no EXIF; per-entry opt-out enforced in A3 **and** A4; restore resets AI consent | Brief §4, §12; user's opt-in decision |
| Provider design | Two adapters (Groq, Gemini) behind one interface; model IDs are data (catalog + `modelOverride`) | Model names change fast (Groq's documented vision model already changed from Llama 4 Scout to Qwen3.8 27B by 2026-10-11) |
| Reminders | Rolling 7-day window of local DATE notifications with deterministic ids, rebuilt on events/foreground | Cancels completed-task reminders, prevents duplicates, no background task needed |
| Backup | Folder via Android directory picker: `manifest.json` + `data.json` (raw rows) + photos; staged restore + single DB transaction | No JS-memory zip of hundreds of MB; atomic restore; original dates/lock state preserved |
| Auto-backup | `android.allowBackup=false` | Prevents silent cloud copies of health data; app export is the backup path (side effect: no automatic restore on a new phone) |
| Charts | Hand-written `react-native-svg` | Avoids an unverifiable third-party chart dependency |
| Workout calories | `round(MET × kg × activeSeconds/3600)` with rough constants light 2.5 / moderate 3.5 / vigorous 5.0; shown only with weight + intensity; labelled rough; hideable; never combined with intake | Brief §6 + user decision; constants are planning values, not a cited table |

## 6. Why 7 agents (not 4–5)
The brief has 8 app sections plus services (camera, AI, backup, reminders, journeys). Five agents would each own ≥ 30 files and several would exceed a free model's single-session output. Seven keeps every package at roughly 15–30 files and gives ownership boundaries that match the dependency map. A7 (shell) is small and can be done by the weakest model.

| Agent | Package | Approx files |
|---|---|---|
| A1 | Foundation: configs, shared types/db/files/events/settings/safety/ui/utils | ~55 |
| A2 | Training (exercises, session mode, history) + Reminders | ~28 |
| A3 | Food log (capture, entries, categories, totals) | ~22 |
| A4 | Nutrition AI (providers, consent UI) + Backup/Restore | ~24 |
| A5 | Progress photos, milestones, journeys, comparisons, timeline | ~24 |
| A6 | Body measurements, journal, progress charts, daily summary | ~24 |
| A7 | App shell: routes, providers, Today, Settings, Onboarding, README | ~42 (mostly tiny) |
All 7 run concurrently. OpenCode integrates; integration order for verification follows brief phases 1→6 (see OpenCode prompt).

## 7. Verified facts used in design (checked 2026-10-11)
- **Expo SDK 57** is the latest stable (released 2026-06-30): React Native 0.86, React 19.2.x; Node ≥ 22.13; Android 7+; compileSdk/targetSdk 36. SDK 58 is in beta (since mid-September 2026) → not used.
- Local dev-build workflow (Expo docs): JDK 17; Android Studio with **Android SDK Platform 36**; `ANDROID_HOME`; USB debugging; `npx expo install expo-dev-client`; `npx expo run:android`.
- `expo-file-system` (SDK 57) has the object API (`File`, `Directory`, `Paths`) plus `expo-file-system/legacy`; `Directory.pickDirectoryAsync` exists on Android; SAF `content://` files don't support `ReadWrite` mode.
- `expo-notifications` 57: local notifications stay available in Expo Go; `scheduleNotificationAsync` with `DATE`/`DAILY`/`TIME_INTERVAL` triggers; Android 12+ needs `SCHEDULE_EXACT_ALARM` for exact timing; Android 13+ needs runtime `POST_NOTIFICATIONS`.
- **Groq** (official docs): vision model documented as `qwen/qwen3.8-27b`; max 3 images/request, each ≈ 2,048 input tokens; Free-plan sample limits 30 RPM / 1K RPD / 8K TPM / 200K TPD; inference data not retained by default, up to 30 days of logs only for reliability/abuse, ZDR available, data in US.
- **Gemini API** (Google pricing page/terms): free tier "used to improve our products: Yes" and human reviewers may read free-tier inputs; paid tier: No.
- **OpenCode** (opencode.ai docs): terminal agent with read/write/edit/bash, search and web tools; install `curl -fsSL https://opencode.ai/install | bash` or `npm install -g opencode-ai`; `/init` creates `AGENTS.md`; Build/Plan agents; 75+ providers; Groq documents an OpenCode integration.

## 8. Not verified (flagged for OpenCode / device testing)
Exact call shapes of `expo-sqlite`, `expo-camera`, `expo-image-manipulator`, `expo-secure-store`, `expo-sharing` and `Directory.pickDirectoryAsync`+SAF copy in SDK 57 (agents code from documentation memory and list them under `UNVERIFIED_EXPO_APIS`; `tsc` against installed packages verifies); the Gemini request shape and current free model ID; Groq model ID at release time; food-estimate quality for South Indian dishes (needs the user's own photos); exact-alarm behavior on the user's phone (Android version unknown); `sql.js` under jest-expo; behavior of same-id notification scheduling.

## 9. Risks & mitigations
| Risk | Mitigation |
|---|---|
| Blind agents drift on interfaces | Verbatim types, registry IDs, comments, `NEW_SYMBOLS.md`, OpenCode audit script |
| Expo API mismatch | Single-owner wrappers; `UNVERIFIED_EXPO_APIS`; `tsc` gate |
| Photo-lock leak | Data-layer enforcement + tests (GAT-021..026) |
| AI sends photos without consent | Two-layer gating + network isolation grep + tests (GAT-012..016) |
| Free-model truncation | ≤ 30 files/agent, files < 400 lines, deliverables as path-labelled files |
| Reminder unreliability | Documented battery/alarm note; device test checklist |
