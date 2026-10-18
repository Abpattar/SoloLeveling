# PROJECT_CONTEXT — session handoff index

Read this file first when resuming work in a new session.

## How to resume

1. Read this index.
2. Read the context page of the **last completed stage** (links below).
3. Read `AGENTS.md` for the hard rules.
4. Check `git status` / recent commits if the folder is a git repo.
5. Continue with the **Next** line below.

## Build status

| Stage | Package | Status | Context page |
|---|---|---|---|
| 0 | Scaffold (Expo 57 deps, root configs) | DONE | [STAGE_00_SCAFFOLD.md](./STAGE_00_SCAFFOLD.md) |
| 1 | A1 Foundation (`src/shared/**`) | DONE — typecheck/lint clean, 97/97 tests | [STAGE_01_FOUNDATION.md](./STAGE_01_FOUNDATION.md) |
| 2 | A2 Training + Reminders | PARTIAL — training done; reminderService/ReminderSettingsSection/index deferred to Stage 3 | [STAGE_02_TRAINING_REMINDERS.md](./STAGE_02_TRAINING_REMINDERS.md) |
| 3 | A3 Food log + reminders completion | DONE — typecheck/lint clean, 313/313 tests | [STAGE_03_FOOD.md](./STAGE_03_FOOD.md) |
| 4 | A4 Nutrition AI + Backup/Restore | DONE — typecheck/lint clean, 436/436 tests | [STAGE_04_AI_BACKUP.md](./STAGE_04_AI_BACKUP.md) |
| 5 | A5 Photos + Journeys | DONE — typecheck/lint clean, 536/536 tests | [STAGE_05_PHOTOS.md](./STAGE_05_PHOTOS.md) |
| 6 | A6 Body + Journal + Progress | DONE — typecheck/lint clean, 635/635 tests | [STAGE_06_BODY_JOURNAL_PROGRESS.md](./STAGE_06_BODY_JOURNAL_PROGRESS.md) |
| 7 | A7 Shell (routes, providers, Today, Settings, Onboarding, README) | DONE — typecheck/lint clean, 100/100 shell tests | [STAGE_07_SHELL.md](./STAGE_07_SHELL.md) |
| 8 | Integration gates (contract script, typecheck, lint, jest) | DONE — all four gates green, 722/722 tests | [STAGE_08_GATES.md](./STAGE_08_GATES.md) |

**Next:** install the debug APK on a phone and verify the runtime, then exercise the app end to end (onboarding → add an exercise → run a session → log a meal → take a progress photo → export a backup).

### Current gates (re-run after every stage)

```
npm run typecheck   # must be silent
npm run lint        # must be silent
npx jest            # must be 0 failures
```

Status: contract-check PASS · typecheck PASS · lint PASS (0 problems) · **722 tests passing in 46 suites**.

### Windows build notes (verified 2026-10-18)

- `npx expo prebuild --platform android --no-install` generates `android/`. It is gitignored, so
  the native project is not committed; regenerate it after a fresh clone.
- Toolchain used: Temurin JDK 17.0.20.1, Android SDK platform-tools + `platforms;android-36` +
  `build-tools;36.0.0`, installed under `%LOCALAPPDATA%\Android\Sdk`.
- `android\gradlew.bat -p android assembleDebug` produced `app-debug.apk`
  (`com.personal.recoveryfitness`, minSdk 24, targetSdk 36, 4 ABIs, ~219 MB — debug builds are
  large because they ship every ABI unstripped).
- APK is a **debug** build: installable for testing, not for distribution. `adb install -r` after
  enabling USB debugging on the phone.
- **Runtime is still unverified** — no device or emulator was available, so DB migrations, camera,
  notifications and SQLite have never actually executed.

### Watch out for at the next stage

- Stage 7 route files must render the screens Stage 6 exported: `MeasurementsScreen`,
  `JournalScreen`, `JournalEntryScreen`, `ProgressScreen`, and a daily-summary route that takes a
  `LocalDate`. `JournalEntryScreen` takes `entryId` (`null` = new entry).
- The SVG charts live in `src/shared/ui/charts/` (not `progress/charts/`), because CONTRACT §2.8
  forbids `body → progress`. Do not move them back and do not re-export them from a module index.
- `test-renderer@1.3.0` is a dev dependency now; `@testing-library/react-native@14`'s `render()` is
  **async**, so component tests must `await render(...)` and query via the exported `screen`.
- `src/shared/**` is finished. Nothing outside Stage 1 may edit it without a CHANGE entry (one was
  recorded for Stage 6: `isoWeekKey` in `dates.ts`).
- `DailySummary.estimatedWorkoutKcal` is never added to intake. No "net"/"TDEE" strings (GAT-030).
- Stage 7 must wire the AI bridge in `src/shell/bootstrap.ts`:
  `setEstimatorBridge({ getAnalysisAvailability, estimateNutritionFromImage })`.
- `npm run contract-check` fails today: `scripts/check-contract.mjs` is Stage 8 work and does not
  exist yet.
- Test variables referenced inside `jest.mock` factories must be named `mock*`.
- Never use a dynamic `await import()` in a repository or a test.

## Spec documents (authoritative order)

user-approved requirements > `SHARED_CONTRACT.md` > `SHARED_SYMBOL_REGISTRY.md` > agent prompts > code.

All spec files are copied into `docs/architecture/` (the originals also still live one level up,
in `D:\Codes\MULTI_AGENT_PROJECT_PACK\`).

## Decisions already made (do not reopen)

- Expo SDK **57** (React Native 0.86, React 19.2). Not SDK 58 (beta).
- Android-first, development build (`expo-dev-client`), local APK sideloading.
- No backend, no accounts, no analytics. Network code exists only in `src/modules/nutrition-ai/**`.
- `android.allowBackup: false`. The app's own export/restore is the backup path.
- Backups are a **folder** (not zip), **unencrypted**, with `BACKUP_PRIVACY_WARNING` shown before export and restore.
- AI analysis ships **OFF**. Two adapters, both unverified at build time: Groq and Google Gemini. Nothing is sent until the user completes the opt-in. Progress photos are never sent.
- Journey rule: nothing unlocks automatically at Day 90. Photos taken after Day 90 are visible immediately unless the user starts Journey 2 (only allowed once Day 90 is unlocked), which completes Journey 1 and restarts locks from today.
- Workout calories: `round(MET × kg × activeSeconds/3600)`, MET light 2.5 / moderate 3.5 / vigorous 5.0 (rough planning constants). Shown only with weight + intensity, hideable, never combined with intake.
- SVG charts are hand-written (`react-native-svg` only) and live in `src/shared/ui/charts/`.

## Deviations / local decisions log

Recorded per stage in each stage context page under "Deviations from the pack".