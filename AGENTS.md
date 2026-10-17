# AGENTS.md — Recovery & Fitness app (working rules for this repo)

## What this repo is

Expo SDK 57 / React Native 0.86 / TypeScript strict, Android-first, local-first rehab tracking app.
**No backend. No accounts. No analytics. No network code outside `src/modules/nutrition-ai/**`.**

Canonical specs live in `docs/architecture/` (SHARED_CONTRACT.md is authoritative).

## Build order (do not reorder; each stage depends on the previous one)

| Stage | Package | Path |
|---|---|---|
| 1 | A1 Foundation | `src/shared/**` + root configs |
| 2 | A2 Training + Reminders | `src/modules/training/**`, `src/modules/reminders/**` |
| 3 | A3 Food | `src/modules/food/**` |
| 4 | A4 Nutrition AI + Backup | `src/modules/nutrition-ai/**`, `src/modules/backup/**` |
| 5 | A5 Photos + Journeys | `src/modules/photos/**` |
| 6 | A6 Body + Journal + Progress | `src/modules/body/**`, `src/modules/journal/**`, `src/modules/progress/**` |
| 7 | A7 Shell | `src/shell/**`, `src/app/**`, `README.md` |
| 8 | Integration gates | `scripts/check-contract.mjs`, typecheck, lint, jest |

After finishing a stage, update `PROJECT_CONTEXT/` (see below) before stopping.

## Hard rules

1. **No `any`, no `@ts-ignore`, no `console.*`.** Use `logger` from `@/shared/utils/logger`.
2. **Repositories throw `AppError`**; I/O services return `Result<T>` (`ok`/`fail`).
3. **SQL is parameterized only.** Columns `snake_case`; TS fields `camelCase`; map explicitly per repository.
4. **Derived values are never stored** (day numbers, lock state, totals, summaries are computed on read).
5. **Locked progress photos must return `imageUri: null`** from the data layer. No path/thumbnail leaks.
6. **Photo lock is motivation, not encryption** — show `LOCK_NOTE_TEXT`.
7. **A meal photo leaves the device only with consent** (`ai.externalAnalysisEnabled` ∧ provider ∧ consent version ∧ API key ∧ ¬`analysisOptOut`).
8. **API keys only** in `src/shared/platform/secureStorage.ts` (Android Keystore). Never in SQLite, backups, logs, source, `app.json`.
9. **Workout calories are never added to or subtracted from intake.** No "net calories", no TDEE.
10. **No diagnosis, rehab staging, exercise progression, or diet prescription** anywhere.
11. **Allowed module edges only:** `training → photos`, `reminders → training`, `reminders → food`, `food → nutrition-ai`, `progress → training|food|body|journal`. `src/shared/**` never imports `@/modules/**`, `@/shell/**`, `@/app/**`.
12. **Cross-module imports:** shared by deep path `@/shared/...`; modules only via `@/modules/<name>` index.
13. Every exported registry symbol carries an `INTEGRATION CONTRACT: <ID>` block; every cross-module import line is preceded by `// CONTRACT: <ID> (<owner>) — why`.
14. Fixed user-facing safety/disclaimer text comes only from `src/shared/constants/text.ts` (`CONST-TEXT-001..010`).
15. One React component per file; files < 400 lines; functions < 60 lines.

## Commands

```bash
npm install --legacy-peer-deps     # dev deps need it (jest-expo peer graph)
npm run typecheck                  # tsc --noEmit
npm run lint                       # eslint flat config
npm test                           # jest
npm run contract-check             # layering + registry + route checks
npx expo run:android               # dev build on the connected phone
```

## Never logged / never stored outside secure storage

Image bytes, base64, `file://` URIs, photo paths, API keys, journal/session note text.
`logger` redacts these key names; do not work around the redactor.