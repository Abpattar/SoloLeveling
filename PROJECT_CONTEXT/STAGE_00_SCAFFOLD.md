# STAGE 0 — Scaffold (DONE)

**Date:** 2026-10-13 · **Machine:** Windows, Node v24.18.0, npm 11.16.0, git 2.55.0
**Project root:** `D:\Codes\MULTI_AGENT_PROJECT_PACK\recovery-fitness`

## What was done

1. Created the project folder and copied the whole project pack into `docs/architecture/`
   (all 13 root `.md` files plus `agent-prompts/`, `integration/`, `opencode/`).
2. `npm install expo@~57.0.0`, then `npx expo install <runtime packages>` so every Expo package
   version is the one `expo install` resolves for SDK 57 (not hand-pinned).
3. Installed dev dependencies.
4. Wrote every root config file owned by A1.
5. Wrote `AGENTS.md` (working rules for this repo) and `PROJECT_CONTEXT/README.md`.

## Installed versions (resolved by `expo install`, SDK 57)

| Package | Version |
|---|---|
| expo | ~57.0.0 (57.0.28) |
| react | 19.2.3 |
| react-native | 0.86.3 |
| expo-router | ~57.0.26 |
| expo-dev-client | ~57.0.20 |
| expo-sqlite | ~57.0.4 |
| expo-camera | ~57.0.6 |
| expo-file-system | ~57.0.7 |
| expo-notifications | ~57.0.22 |
| expo-secure-store | ~57.0.4 |
| expo-image-manipulator | ~57.0.21 |
| expo-sharing | ~57.0.23 |
| expo-crypto | ~57.0.4 |
| expo-keep-awake | ~57.0.2 |
| expo-constants | ~57.0.21 |
| expo-linking | ~57.0.12 |
| expo-status-bar | ~57.0.1 |
| react-native-svg | 15.15.4 |
| react-native-safe-area-context | ~5.7.0 |
| react-native-screens | ~4.26.0 |
| @react-native-community/datetimepicker | 9.1.0 |
| typescript | ~6.0.3 |
| jest | ~29.7.0 |
| jest-expo | ~57.0.6 |
| @types/jest | ^29.5.14 |
| @testing-library/react-native | ^14.1.0 |
| sql.js / @types/sql.js | ^1.14.2 / ^1.4.11 |
| eslint | ^10.12.0 |
| eslint-config-expo | ~57.0.2 |
| prettier | ^3.9.10 |
| @types/react | ~19.2.2 |

All of these are on the CONTRACT §1 approved list **except** `@types/react`, which is a type-only
package required to typecheck TSX. It is also what the official
`expo-template-blank-typescript` ships with. Logged as `CHANGE-TECH-001` below.

## Files created

```
package.json            app.json                tsconfig.json
babel.config.js         jest.config.js          jest.setup.ts
eslint.config.js        .prettierrc.json        .gitignore
AGENTS.md               PROJECT_CONTEXT/README.md
docs/architecture/**    (verbatim copy of the pack)
```

## Deviations from the pack

### CHANGE-TECH-001 — added `@types/react` to devDependencies (resolved, no user decision needed)

- **Why needed:** `tsc --noEmit` on `.tsx` files fails without React's type declarations. Without
  it, no TypeScript file in `src/**` can be checked, so the whole quality gate (GAT-045) dies.
- **Why the approved list does not satisfy it:** CONTRACT §1 §Dev lists `typescript`, `jest`,
  `jest-expo`, `@types/jest`, `@testing-library/react-native`, `sql.js`, `@types/sql.js`,
  `eslint`, `eslint-config-expo`, `prettier` — `@types/react` is missing.
- **Exact declaration:** `"@types/react": "~19.2.2"` in `devDependencies` (type-only, ships no
  runtime code, cannot reach a device build).
- **Affected:** none. No source file changed.
- **Can work continue without a decision:** yes. If the user rejects it, `tsc` cannot run and the
  typecheck gate must be reported as NOT RUN.

### NOTE-TECH-002 — `npm install` needs `--legacy-peer-deps` for dev dependencies

`jest-expo@57.0.6` declares a peer on `react-server-dom-webpack ~19.2.4`, and npm resolves a
`react-dom@19.3.0` edge that conflicts with the React version Expo SDK 57 pins (19.2.3).
Runtime dependencies install cleanly without the flag; only the dev set needs it.
**Use `npm install --legacy-peer-deps`.** Do not "fix" this by adding `react-dom` or
`react-native-web` — this is an Android-only app and the contract does not approve those packages.

### NOTE-TECH-003 — `expo-env.d.ts` not created

Expo generates it on first `expo start` / `expo prebuild`. It is not needed for `tsc --noEmit`
with an explicit `include`.

### NOTE-TECH-004 — `typedRoutes` experiment off

`tsconfig.json` sets no `experiments.typedRoutes`, so route params stay `string` and each route
file parses and validates them itself (CONTRACT §4 requires route files to do exactly that).

## Verified in this stage

- `npm view expo version` → `57.0.28` (confirms SDK 57 is current stable on 2026-10-13).
- `npx expo install` resolved every Expo package version itself — no version guessing.

## NOT verified in this stage

- No Expo API has been called yet (Stage 1+ will exercise them).
- `npx tsc --noEmit`, `npm test`, `npm run lint` have **not run yet** — there is no source code yet.
- No APK build. That needs JDK 17 + Android SDK Platform 36 (not present on this Windows box yet).

## Next

**Stage 1 — A1 Foundation.** Write `src/shared/**` per
`docs/architecture/agent-prompts/AGENT_01_PROMPT.md`. Follow the file order in its section 3 table.
Then write `PROJECT_CONTEXT/STAGE_01_FOUNDATION.md`.