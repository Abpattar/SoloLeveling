# STAGE_08_GATES.md — Integration gates context

## Summary

Stage 8 is DONE. `scripts/check-contract.mjs` exists and is wired to `npm run contract-check`,
which previously failed. All four gates pass: contract-check, typecheck, lint, jest.

## Gates

| Gate | Command | Result |
|---|---|---|
| Contract | `npm run contract-check` | OK — 220 files conform |
| Types | `npm run typecheck` | silent |
| Lint | `npm run lint` | 0 problems |
| Tests | `npx jest` | 722 / 722, 46 suites |

## What the contract gate enforces

1. **Layering (§2.7, §2.8).** `src/shared/**` never imports modules/shell/app; a module reaching
   another module goes through its `index.ts` only, and only along the allowed edges
   (`training→photos`, `reminders→training|food`, `food→nutrition-ai`,
   `progress→training|food|body|journal`). Same-module imports and test files are exempt.
2. **Language hygiene.** No `any`, no `@ts-ignore`/`@ts-expect-error`, no `console.*` outside the
   single `logger` sink, no dynamic `await import()` in production code.
3. **SQL safety (§2.5).** A template literal is only treated as SQL when it starts with a statement
   keyword, and then every interpolated expression must be a known-safe fragment identifier
   (`where`, `limit`, `columns.join(…)`, `placeholders`, `table`, `*_COLUMNS`, …). Interpolating a
   *value* is flagged. String-concatenated SQL is flagged.
4. **Medical safety (GAT-030).** No "net calories", "TDEE", or "total daily energy expenditure".
5. **Routes (§4).** Every route file exists, renders its named component, stays ≤ 15 code lines, and
   imports no module internals.

Each allowlisted SQL fragment is justified in a comment next to the allowlist, so a future change
that interpolates a value instead fails loudly.

## Files added / changed in this stage

- `scripts/check-contract.mjs` (new) — the gate itself, Node stdlib only
- `scripts/__tests__/contractGate.test.ts` (new) — 5 tests proving the gate works
- `eslint.config.js` — `no-console: off` scoped to `scripts/**` (a CLI's output channel is stdout;
  the rule exists to keep *app* code logging through `logger`)
- shell test files — removed stale `eslint-disable` directives and duplicate imports (lint is now
  warning-free)
- `PROJECT_CONTEXT/README.md`, this page

## Testing the gate itself

A gate that only ever reports OK is worthless, so `scripts/__tests__/contractGate.test.ts` copies
the tree into a temp sandbox, injects a violation, and asserts the script exits 1 with the right
message. Covered: shared→module import, disallowed module edge, missing CONTRACT §4 route, and
forbidden net-calorie wording. All 5 tests pass.

## Known limitations

- The gate is regex/heuristic based. It catches the cheap, high-value mistakes (wrong import layer,
  `any`, console, unparameterized values, banned wording, missing routes) but it is not a type
  checker; `tsc` remains the authority for types.
- Comments and string bodies are stripped before the hygiene/SQL checks, so a violation hidden
  inside a comment is not reported (by design — the docs quote SQL and banned wording legitimately).

## Verified commands

```
npm run contract-check   OK — 220 files conform
npm run typecheck        silent
npm run lint             0 problems
npx jest                 722/722 passing, 46 suites
```

## Questions for the user

None blocking.