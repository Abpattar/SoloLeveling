# CODING_CONVENTIONS.md

**Version 1.0.** Applies to every agent and to OpenCode.

## 1. Language and style
- TypeScript strict. Named exports only (no default exports) **except** screen files under `src/app/**` (route default exports). One React component per file; component file = PascalCase; other files = camelCase.
- ESM `import`/`export`; imports ordered: react / react-native → expo-* → third party → `@/shared/*` → `@/modules/*` → relative. Use the `@/` alias, never `../../..` across directories (same-directory relatives are fine).
- Prettier defaults (single quotes, semicolons, 100 cols, trailing commas `all`). No `console.*` (use `logger`). No `any`, `@ts-ignore`, `@ts-expect-error` without a one-line reason and a `TODO(<AGENT-ID>)`.
- Files < 400 lines; functions < 60 lines; split otherwise (inside your module).
- React: function components + hooks; `StyleSheet.create`; theme via `useTheme()` (no hard-coded colors outside `theme.ts`); every Pressable has `accessibilityRole` and a label; touch targets ≥ 44 px.
- Async: `async/await`; never leave floating promises (`void promise.catch(...)` pattern with `logger.warn`).
- SQL: parameterized always (`?` placeholders), never string-interpolate values; table/column names only from the DDL.

## 2. Naming
Symbols exactly as in the registry (case-sensitive). Booleans `is/has/should…` in local code (contract types keep their contract names). Events `<area>.<noun>.<verb>`. Test files `<unit>.test.ts(x)`.

## 3. Errors
Follow CONTRACT §2.6: repositories throw `AppError` (use the specific code); I/O services return `Result<T>`. Never swallow errors silently: either handle, convert with `toAppError`, or `logger.warn`. Validate all inputs at the repository boundary (types alone are not validation). UI catches errors and shows `ErrorBanner` with `error.message`.

## 4. Integration comments (mandatory)
Every exported cross-module symbol (those with a registry ID you own):
```ts
/**
 * INTEGRATION CONTRACT: API-FOOD-006
 * Purpose: Create a food entry from a camera photo and start optional analysis.
 * Canonical definition: src/modules/food/data/foodRepository.ts
 * Consumers: src/modules/food/screens/FoodCaptureScreen.tsx
 * Contract status: APPROVED
 */
```
Every import of a symbol owned by another agent is preceded by one line:
```ts
// CONTRACT: API-FILE-001 (A1) — private photo copy
import { savePhotoFromUri } from '@/shared/files/photoStorage';
```
Comments explain *what the symbol is for and who provides/consumes it*; do not comment ordinary local code.

## 5. New or changed shared symbols
If you genuinely need a symbol, field, route, event, table column, dependency or text constant that is not in the registry/contract: do NOT invent a competing one. Mark the place in code with:
```ts
/**
 * NEW — INTEGRATION REQUIRED
 * Proposed symbol: <name>   Change ID: CHANGE-<AREA>-<NNN>
 * Purpose: …  Proposed owner: …  Proposed signature: <full TypeScript signature>
 * Potential consumers: …  Required action: review and approve the contract update
 */
```
(fill every field; no placeholders) and list it in `NEW_SYMBOLS.md`. Prefer a local workaround inside your own module that keeps the contract intact; mark it `// LOCAL-WORKAROUND (CHANGE-…)`.

## 6. Testing
Jest + `jest-expo`. Pure logic and repositories: `/** @jest-environment node */`, `createTestDb()` + `setDbForTesting()`. Required per module: validation errors, boundary values, persistence round-trip, event emission, and the module-specific cases in the agent prompt. Name tests after behavior ("rejects early unlock without confirmation"). Do not hit the network; mock `fetch`. Do not claim a test ran unless it did; report exact commands and results in the handover.

## 7. Unverified Expo APIs
You cannot run the Expo packages. When you call an Expo/React-Native API from memory, use the documented SDK 57 shape (https://docs.expo.dev/versions/v57.0.0/sdk/<package>/) and list it in `AGENT_HANDOVER.md` under `UNVERIFIED_EXPO_APIS` as `package · API · file:line · confidence (high/medium/low)`. If you can see installed `node_modules` types, prefer them and say so.

## 8. Dependencies
Only packages in CONTRACT §1. No native modules, no analytics, no UI kits, no date libraries (use `@/shared/utils/dates`), no state libraries, no chart libraries.
