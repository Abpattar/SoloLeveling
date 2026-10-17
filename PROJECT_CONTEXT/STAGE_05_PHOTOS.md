# STAGE 5 — A5 Photos + Journeys (DONE)

**Date:** 2026-10-13 · **Package:** A5 (`src/modules/photos/**`)
**Gates:** `npm run typecheck` PASS · `npm run lint` PASS (0 errors, 0 warnings) · `npx jest` **536 passed / 536 total, 33 suites**

## Files created

```
src/modules/photos/index.ts                        module public surface
src/modules/photos/domain/milestones.ts           CONST-PHOTO-001/002 + API-PHOTO-014..017
src/modules/photos/domain/photoViews.ts            internal pure builders (the lock lives here)
src/modules/photos/data/journeyRepository.ts      API-PHOTO-001..005
src/modules/photos/data/photoRepository.ts        API-PHOTO-006..010, 012, 013
src/modules/photos/services/photoExport.ts        API-PHOTO-011
src/modules/photos/hooks/useActiveJourney.ts       HOOK-PHOTO-001
src/modules/photos/screens/PhotosHomeScreen.tsx           CMP-PHOTO-001
src/modules/photos/screens/ProgressPhotoCaptureScreen.tsx CMP-PHOTO-002
src/modules/photos/screens/PhotoComparisonScreen.tsx     CMP-PHOTO-003
src/modules/photos/screens/PhotoTimelineScreen.tsx       CMP-PHOTO-004
src/modules/photos/screens/JourneysScreen.tsx            CMP-PHOTO-005
src/modules/photos/components/TodayMilestoneCard.tsx     CMP-PHOTO-006
src/modules/photos/components/ProgressPhotoPromptCard.tsx CMP-PHOTO-007
src/modules/photos/components/JourneySettingsSection.tsx CMP-PHOTO-008
src/modules/photos/components/MilestoneCard.tsx          internal
src/modules/photos/components/PhotoGrid.tsx              internal
src/modules/photos/__tests__/{milestones,photoViews,journeyRepository,photoRepository}.test.ts
```

## The one module edge `training → photos` is now live

`src/modules/training/screens/SessionCompleteScreen.tsx` imports
`ProgressPhotoPromptCard` from `@/modules/photos` and renders it below the Save button
(GAT-052, REQ-PHO-002). Skip only hides the card; session completion is untouched.

## How the lock is actually enforced

Three layers, all tested:

1. **`buildPhotoViews`** (pure) computes `unlockMilestone` and `visible`, and calls the injected
   `resolveUri` **only for a visible photo**. A locked photo's path never leaves this function —
   it is not in the returned object at all. Test: *"only ever calls resolveUri for a visible photo"*.
2. **`PhotoGrid`** filters `visible === true && imageUri !== null` again, so even a bug upstream
   cannot reach an `<Image>`.
3. **`exportProgressPhoto`** checks visibility before resolving the path, so a locked photo cannot
   be shared. Test: *"refuses a locked photo and never resolves its path"*.

`ProgressPhotoView` has no `imagePath` field at all — asserted directly by key-listing the object.

## A finding worth keeping: mixed visibility is impossible inside one journey

The tests forced this out. Within a single journey, real capture dates mean:

- today < Day 30 → every photo is locked;
- today ≥ Day 90 → every photo is unlocked;
- Day 30 ≤ today < Day 90 → photos ≤ Day 90 are locked, but any photo past Day 90 would have to be
  dated in the future, and future captures are rejected.

So a journey is never half-locked. "Photo A visible, photo B locked" can only happen across
journeys (Journey 1 unlocked, Journey 2 freshly locked). Two tests now assert the real behaviour
rather than a fiction, and the "new journey restarts the locks" test covers the mixed case.

## Early unlock rules (SEC-09, GAT-023) — all five cases tested

| Case | Result |
|---|---|
| `{ confirmed: false }` | `VALIDATION`, nothing written |
| Day 60 or 90 while Day 30 is still pending | `VALIDATION` |
| `day` not in {30,60,90} | `VALIDATION` |
| next pending + `{ confirmed: true }` | unlocks, `unlockedEarly: true`, Day 60 becomes next pending |
| already unlocked | `CONFLICT` |

## Journey rules (GAT-025/026) — tested

- `createFirstJourney`: ≤ today only, `CONFLICT` if one exists.
- `updateJourneyStartDate`: future rejected; a date that would push an existing photo before Day 1
  rejected; for journey N>1 the start may not precede journey N−1's `completed_on`; **early unlocks
  are kept**; day numbers are recomputed while `capturedOn`/`capturedAt` stay untouched.
- `startNextJourney`: rejected before Day 90 is unlocked (by date **or** by early unlock), one
  transaction completes the current journey and inserts the next, exactly one active journey,
  numbering increments. Tested through Journey 3 with `jest.setSystemTime` advancing 91 days.
- Completed journeys' photos stay visible; new-journey photos lock again.

## Tests added (100 new, all passing)

| Suite | Covers |
|---|---|
| `milestones.test.ts` (26) | `MILESTONE_DAYS` / `DEFAULT_TIMELINE_DAYS`, unlock-date math across month/year/leap-day, Day 90 = start + 89, a DST change inside the window, the full GAT-022 mapping table (day −10 → 30 up to day 91 → null), locked the day before / unlocked on the day, early unlock does not unlock a later milestone, next-pending progression, null when all three are unlocked |
| `photoViews.test.ts` (22) | day number + hidden photo, **path never in the locked view**, `resolveUri` called only for visible photos and exactly once each, after-Day-90 visible, reveal on unlock date and on early unlock, oldest-first sorting, milestone states with `lockedPhotoCount` and `unlockedEarly`, comparison baseline = earliest **visible**, target = greatest day in the window, baseline never reused as target, timeline exact-day matching and locked-day emptiness |
| `journeyRepository.test.ts` (21) | create/active/list/conflict, `startNextJourney` before and after Day 90, one-active-journey invariant, Journey 3 via fake timers, start-date edit keeps early unlocks, future rejected, photo-before-Day-1 rejected, previous-journey bound, day numbers recomputed, new journey locks again while the old stays visible |
| `photoRepository.test.ts` (31) | add into the active journey, no journey → error, future capture rejected, category + session link saved, **unknown session id rejected by the FK**, copy failure writes nothing, insert failure deletes the file, list shape (all locked with null URIs / all visible after Day 90), `imagePath` absent from the view type, milestone counts, all five early-unlock cases, delete removes row + file, comparison + timeline behaviour, export `LOCKED` / share / unsupported / not-found, new journey restarts the locks |

## Test count ledger

| After stage | Suites | Tests |
|---|---|---|
| Stage 1 | 12 | 97 |
| Stage 2 | 17 | 205 |
| Stage 3 | 23 | 313 |
| Stage 4 | 29 | 436 |
| Stage 5 | 33 | **536** |

## Deviations / local decisions

1. **`loadEarlyUnlockedDays` is exported from the photos index** as a documented LOCAL-WORKAROUND.
   `TodayMilestoneCard` needs the early-unlock list to show the right *next pending* milestone. It is
   read-only and unlocks nothing; `unlockMilestoneEarly` remains the only way to unlock.
2. **`getActiveJourney` and `listJourneys` are static imports inside `photoRepository.ts`**, not
   dynamic ones, so the module works under Jest. `photoRepository → journeyRepository` is an
   intra-module edge, not a module-edge violation.
3. **The capture screen reports the exact unlock date** ("Saved. Hidden until Day 30 (29 Jan 2026).")
   so the wait is never a surprise — the user asked for that behaviour in REQ-PHO-004.
4. **`photoExport` treats an unsupported share sheet as `UNSUPPORTED`**, and a missing photo as
   `NOT_FOUND` — both are `Result` failures, never throws.
5. `PhotoTimelineScreen` lets the user add an arbitrary day number on top of
   `DEFAULT_TIMELINE_DAYS`, as the prompt asks.

## Next

**Stage 6 — A6 Body + Journal + Progress.** Read
`docs/architecture/agent-prompts/AGENT_06_PROMPT.md`, and `SHARED_CONTRACT.md` §3.9 for `DailySummary`.

Constraints to remember:
- `progress` may import `training | food | body | journal` — through their **index files only**.
- `getDailySummary` must never add workout calories to intake (SAF-06, GAT-030). No "net" or "TDEE"
  strings anywhere.
- Weight trend: one point per date, plus a 7-day trailing average; add the caption
  "Day-to-day changes are normal" and never interpret a change as proof of muscle recovery (SAF-07).
- Charts are hand-written with `react-native-svg`; there is no chart library (CONTRACT §1).