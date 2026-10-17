# Recovery & Fitness

Expo SDK 57 / React Native 0.86 / TypeScript strict. Android-first, local-first rehab tracking app.

**No backend. No accounts. No analytics.** All data stays in on-device SQLite. The only
network code in the repo lives in `src/modules/nutrition-ai/**` and is opt-in per user consent.

## Status

Stages 1-6 are built and unit-tested. The app shell (`src/app`, `src/shell`) is stage 7 and is
not written yet, so the app does not launch. See `PROJECT_CONTEXT/` for per-stage notes.

| Stage | Package | Path | State |
|---|---|---|---|
| 1 | A1 Foundation | `src/shared/**` | done |
| 2 | A2 Training + Reminders | `src/modules/training`, `src/modules/reminders` | done |
| 3 | A3 Food | `src/modules/food` | done |
| 4 | A4 Nutrition AI + Backup | `src/modules/nutrition-ai`, `src/modules/backup` | done |
| 5 | A5 Photos + Journeys | `src/modules/photos` | done |
| 6 | A6 Body + Journal + Progress | `src/modules/body`, `src/modules/journal`, `src/modules/progress` | done |
| 7 | A7 Shell | `src/app`, `src/shell` | pending |
| 8 | Integration gates | `scripts/check-contract.mjs` | pending |

## Commands

```bash
npm install --legacy-peer-deps     # jest-expo peer graph needs it
npm run typecheck                  # tsc --noEmit
npm run lint                       # eslint flat config
npm test                           # jest
npm run contract-check             # layering + registry + route checks
npx expo run:android               # dev build on the connected phone
```

## Architecture

`docs/architecture/` holds the specs. `SHARED_CONTRACT.md` is authoritative and
`SHARED_SYMBOL_REGISTRY.md` is the symbol index. `AGENTS.md` has the working rules
(build order, module edges, hard constraints) — read it before changing anything.

## Data and safety posture

- API keys live only in `src/shared/platform/secureStorage.ts` (Android Keystore). Never in SQLite, backups, logs, or source.
- A meal photo leaves the device only with explicit consent (`ai.externalAnalysisEnabled` and a configured provider and API key and not `analysisOptOut`).
- Locked progress photos return `imageUri: null` from the data layer. No path or thumbnail leaks.
- Workout calories are never added to or subtracted from intake. No "net calories", no TDEE.
- No diagnosis, rehab staging, exercise progression, or diet prescription anywhere in the app.
