# AGENT_INTEGRATION_PROTOCOL.md (includes change control)

**Version 1.0.** How isolated agents report, and how OpenCode and the user decide changes. Templates are in `integration/TEMPLATES.md`.

## 1. Agent deliverable package
Each agent returns:
1. **Source files** at their exact project-relative paths (CONTRACT/FILE_OWNERSHIP_MAP). No duplicates of files owned by others. No stubs of other agents' files in the deliverable (use a scratch folder for local checks and omit it).
2. **Handover files under `handover/AGENT-0X/`** (so they cannot collide when merged): `AGENT_HANDOVER.md`, `NEW_SYMBOLS.md`, `DEPENDENCIES.md`.
3. **Tests** inside module `__tests__/` folders; the handover states exactly which commands were run, which tests passed/failed, and which could not run and why.
4. **Packaging:** if your environment can create ZIP/downloads, ZIP the project-relative tree (`src/...`, `handover/...`, root files you own). Otherwise output files as path-labelled blocks using exactly:
   ```
   === FILE: src/modules/food/data/foodRepository.ts ===
   <full file content>
   === END FILE ===
   ```
   One file per block; never abbreviate with "...rest unchanged". Never claim a file was tested, run, or zipped unless it was.
5. **Truncation protocol:** if your reply limit is reached, stop at a file boundary, write `CONTINUE FROM: <next path>`, and resume there when told "continue". Never emit half a file.

## 2. Required contents
- **AGENT_HANDOVER.md:** agent ID/module; files created (path list); features implemented (REQ IDs); public exports (registry IDs); imports of other agents' symbols (IDs); packages/config needed; commands used and real results; assembly instructions; known issues; `UNVERIFIED_EXPO_APIS` table; assumptions made.
- **NEW_SYMBOLS.md:** every proposed symbol/field/route/event/column/dependency/text change, or the single word `None`. Per item: CHANGE ID (`CHANGE-<AREA>-<NNN>`, AREA = registry area code of your module), why needed, why the existing contract cannot satisfy it, exact proposed declaration and location, affected files/modules, affected contracts/prompts, whether work can continue without a decision.
- **DEPENDENCIES.md:** table of every cross-module reference: contract ID · symbol · providing agent · file(s) in your module that use it; plus packages and config required.

## 3. Handling uncertainty
- **A. Product ambiguity** (affects product behavior, cost, privacy, security, medical safety, UX): do not guess; implement the safest minimal behavior consistent with the brief and record it in `AGENT_HANDOVER.md` under "Questions for the user".
- **B. Already decided by architecture:** follow it; do not reopen.
- **C. Unexpected implementation dependency:** check the contract; if a local workaround violates it, propose a CHANGE instead of inventing an interface. Prefer a workaround inside your own module marked `LOCAL-WORKAROUND`.
- **Disagreement between documents:** record the conflict in `NEW_SYMBOLS.md` under "Conflicts" (documents, sections, what you implemented). Hierarchy: user-approved requirements > CONTRACT > REGISTRY > agent prompt > agent code/handover > OpenCode decisions (which may not silently violate approved requirements).

## 4. Change control
| Class | Examples | Who decides |
|---|---|---|
| Local | internal helpers, private file splitting, styling | the owner, no record needed (list new helper files in handover) |
| Contract | new/changed registry symbol, shared type field, route, event, table/column, constant text, dependency | OpenCode validates; recorded in `INTEGRATION_CHANGELOG.md`; registry/contract updated in ONE coordinated pass (all call sites, tests, docs) |
| Product/safety/privacy/cost | changes to consent, lock rules, medical boundary, paid services, new network hosts, uploading photos, analytics | **the user must approve** before OpenCode applies |

Change record (kept in `INTEGRATION_CHANGELOG.md`): Change ID · symbol/requirement · original definition · proposed definition · reason · impacted files/modules · affected agent prompts · backward-compatibility consequences · required tests · status (`PROPOSED` / `APPROVED` / `REJECTED` / `SUPERSEDED`) · decided by/date. OpenCode must test a proposed change against the full requirement list, not just the proposer's need. Do not create bureaucracy for harmless internal edits.

## 5. Integration-time rules for OpenCode (summary; full prompt in `opencode/`)
Inspect before editing; audit first; reconcile toward the contract; update every caller; keep one canonical declaration per symbol; record significant decisions; never silently delete features or weaken privacy/safety; ask the user when behavior (not just naming) conflicts and the requirements cannot decide.
