# STAGE 4 — A4 Nutrition AI + Backup/Restore (DONE)

**Date:** 2026-10-13 · **Package:** A4 (`src/modules/nutrition-ai/**`, `src/modules/backup/**`)
**Gates:** `npm run typecheck` PASS · `npm run lint` PASS (0 errors, 0 warnings) · `npx jest` **436 passed / 436 total, 29 suites**

## Files created

### Nutrition AI (the only network code in the app)
```
src/modules/nutrition-ai/index.ts                    API-AI-001..003, CMP-AI-001
src/modules/nutrition-ai/availability.ts             getAnalysisAvailability + getApiKeyForProvider
src/modules/nutrition-ai/estimateService.ts          estimateNutritionFromImage + assertPrivateFoodPhoto
src/modules/nutrition-ai/httpClient.ts               THE ONLY `fetch(` call site + host allow-list
src/modules/nutrition-ai/imagePrep.ts                the only expo-image-manipulator importer
src/modules/nutrition-ai/prompt.ts                   buildSystemPrompt + buildUserText
src/modules/nutrition-ai/parseEstimate.ts            parseEstimateJson + extractJsonObject
src/modules/nutrition-ai/providers/types.ts          internal VisionProvider interface
src/modules/nutrition-ai/providers/catalog.ts        AI_PROVIDER_CATALOG (verbatim CONTRACT §7)
src/modules/nutrition-ai/providers/groqAdapter.ts
src/modules/nutrition-ai/providers/geminiAdapter.ts
src/modules/nutrition-ai/AnalysisSettingsSection.tsx CMP-AI-001
src/modules/nutrition-ai/__tests__/{parseEstimate,availability,adapters,estimateService}.test.ts
```

### Backup
```
src/modules/backup/index.ts                 API-BKP-001..003, CMP-BKP-001/002, setBackupFs
src/modules/backup/backupFs.ts              internal BackupFs interface + expo-file-system impl
src/modules/backup/manifest.ts              folder name, buildManifest, validateManifest, validateDataJson
src/modules/backup/exporter.ts              exportBackup
src/modules/backup/restorer.ts              previewBackup, restoreBackup
src/modules/backup/BackupScreen.tsx         CMP-BKP-001
src/modules/backup/BackupSettingsSection.tsx CMP-BKP-002
src/modules/backup/__tests__/{manifest,restorer}.test.ts
```

## How the `food → nutrition-ai` edge is wired

The shell does it, in one line, at bootstrap (Stage 7):

```ts
// src/shell/bootstrap.ts
import { setEstimatorBridge } from '@/modules/food';          // already exported by food/index.ts
import { estimateNutritionFromImage, getAnalysisAvailability } from '@/modules/nutrition-ai';

setEstimatorBridge({ getAnalysisAvailability, estimateNutritionFromImage });
```

`@/modules/nutrition-ai` does **not** import from `@/modules/food` and does **not** export a
`setEstimatorBridge` — that would have been a forbidden edge. The shell may import any module index,
so it is the only legal place to join the two.

## Security properties, and where each is proved

| Rule | Implementation | Test |
|---|---|---|
| SEC-02 no network outside this module | one `fetch(` in `httpClient.ts` | Stage 8 `check-contract.mjs` grep |
| SEC-05 host allow-list | `assertAllowedUrl`: https + exact host + no path tricks | `adapters.test.ts` 8 reject cases |
| SEC-04 progress photos never sent | `assertPrivateFoodPhoto` needs the private root + `food/` prefix + a `resolvePhotoUri` round-trip (which rejects `..`) | `estimateService.test.ts` 7 reject cases, fetch never called |
| SEC-03 two-layer consent | A3 per-entry opt-out, then `getAnalysisAvailability` re-checked inside the estimator | `estimateService.test.ts` "makes no request at all with default settings" |
| SEC-06 key only in secure storage | `getSecret` only; key in a header only; never in body/URL/log/message | "never lets the API key appear in a returned message" |
| Error bodies never shown | generic message; status in `details`; rejected host never echoed | "maps 500 … hides the response body" |

## Three real bugs the tests caught

1. **`postJson` mapped a broken response mock to OFFLINE** — a test-harness issue, but it exposed
   that `mapTransportError` treats *any* `TypeError` as "no connectivity". That is correct for React
   Native's fetch, so the test mock was fixed instead (`reply()` now returns a real
   `text()`/`json()` pair).
2. **A fully-capped estimate was reported as `PARSE_ERROR`.** If every number exceeded its
   CONTRACT §7 cap, all values became null and the "nothing usable" guard fired. `clampNumber` now
   records whether the model produced *any* usable number, so a capped-but-real answer stays a valid
   empty estimate while a response with no numbers at all is still a parse failure.
3. **`restoreBackup` called `prepareStagingPhotoRoot()` per photo** — which deletes and recreates the
   staging directory, wiping the photos already staged. It is now called exactly once and the staging
   root is reused. This would have produced silent data loss on a real restore.

## Registry IDs delivered

AI: API-AI-001, API-AI-002, API-AI-003, CMP-AI-001 ·
BKP: API-BKP-001, API-BKP-002, API-BKP-003, CMP-BKP-001, CMP-BKP-002 · emits EVT-DB-001.

## Tests added (123 new, all passing)

| Suite | Covers |
|---|---|
| `parseEstimate.test.ts` (24) | fence stripping, prose + JSON, braces inside strings, escaped quotes, full mapping, totals summed from items, null macro rules, all four caps → null + `low`, negative/NaN/string values rejected, clarification kept only with a question and 2–4 options, `not_food`, unknown fields ignored, unknown confidence, items without a name, and 6 `PARSE_ERROR` cases |
| `availability.test.ts` (13) | the exact `disabled → no_provider → no_consent → no_api_key → ready` order, disabled wins over everything, consent voided by provider change and by disclosure version change, blank key = missing, catalog contents and disclosure wording |
| `adapters.test.ts` (22) | host allow-list accepts/rejects 8 URLs and never echoes the host, Groq + Gemini endpoints, key in a header only, model + image data URI + JSON mode, exactly one image, `extractText` for both shapes and error payloads, prompt contains the South Indian dish list / household units / hidden fats / JSON schema / one-clarification rule / no diet advice |
| `estimateService.test.ts` (25) | zero requests by default (GAT-013) and with a missing key, progress/gallery/remote URIs → `VALIDATION` with fetch and imagePrep never called (GAT-017), success for both providers, model override, `notFood`, 429 → `RATE_LIMITED`, 500 → `PROVIDER_ERROR` with the body hidden, 401 → key message without the key, `TypeError` → `OFFLINE`, garbage → `PARSE_ERROR`, abort → `CANCELLED`, key never in the result, exactly one request with exactly one image |
| `manifest.test.ts` (14) | folder-name format, buildManifest, all `UNSUPPORTED` and `PARSE_ERROR` manifest cases, `data.json` shape, column-value whitelist |
| `restorer.test.ts` (18) | export `CANCELLED`, manifest written **last**, row counts equal the DB, photos copied, all three progress phases, no key ever written; preview `CANCELLED` / valid / no manifest; restore unconfirmed rejected, full round-trip preserving session rows, journeys + early unlocks preserved verbatim, photo root committed and `data.restored` emitted, AI consent reset, schema mismatch / missing photo / incomplete data.json all leave the DB untouched, and an unstorable row rolls back and discards staging |

## Test count ledger

| After stage | Suites | Tests |
|---|---|---|
| Stage 1 | 12 | 97 |
| Stage 2 | 17 | 205 |
| Stage 3 | 23 | 313 |
| Stage 4 | 29 | **436** |

## NOT verified — must be checked on a real device / real account in Stage 8

1. **Gemini request shape.** `generateContent` with `systemInstruction`, `contents[].parts[].inlineData`
   and `generationConfig.responseMimeType` was written from the 2026-10 pack notes and **not**
   re-verified against Google. Confirm at https://ai.google.dev/gemini-api/docs/models.
2. **Gemini default model id** `gemini-2.5-flash-lite` — the catalog itself says NOT re-verified.
3. **Groq `reasoning_effort: 'low'`** — the field name and accepted values change; a 400 here would
   surface as `PROVIDER_ERROR`.
4. **Groq vision model id** `qwen/qwen3.8-27b` — documented on 2026-10-11, model ids move fast.
5. **SAF directory copy.** `Directory.pickDirectoryAsync()` returns a **content://** directory on
   Android. `backupFs.writeTextFile` / `copyPhotoInto` / `copyPhotoOut` use `createFile` + `write` and
   `File.copy`; none of that has been run against a real SAF directory. This is the single biggest
   device-only risk in the whole project.
6. **Rate-limit behaviour** of the free tiers, and whether a 403 (region/lab restriction) is surfaced
   acceptably.

The app is **safe by default** while all of the above is unverified: analysis is `disabled` until the
user completes the opt-in, and a provider failure can only ever cost a retry, never data.

## Next

**Stage 5 — A5 Photos + Journeys.** Read `docs/architecture/agent-prompts/AGENT_05_PROMPT.md` and
`SHARED_CONTRACT.md` §10 in full.

Two edits are waiting on this stage:
1. Add `ProgressPhotoPromptCard` to `src/modules/training/screens/SessionCompleteScreen.tsx`
   (GAT-052, REQ-PHO-002).
2. `src/modules/training` gains its only module edge, `training → photos`.