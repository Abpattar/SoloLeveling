# STAGE_07_SHELL.md — A7 Shell context

## Summary

Stage 7 (A7 Shell) is DONE. `src/app/**` (expo-router route files), `src/shell/**` (providers, bootstrap, gate, Today, Settings + 4 sections, Onboarding) and `README.md` are written, typechecked, linted and tested.

## Files added (stage 7)

src/shell/
- bootstrap.ts            API-SHELL-001 — getDb → wire estimator bridge → initializeReminders → foreground listener for processPendingAnalyses; reminders/AI failures are logged, never thrown; DB failure rejects and is retryable
- AppProviders.tsx        CMP-SHELL-001 — SafeAreaProvider, bootstrap gate, LoadingView until ready, ErrorBanner + retry on failure
- SetupGate.tsx           CMP-SHELL-005 — redirects to /onboarding until onboardingCompleted
- OnboardingScreen.tsx    CMP-SHELL-004 — disclaimer → profile/units → Day 1 start date → createFirstJourney → completeOnboarding → replace('/'); resumable
- TodayScreen.tsx         CMP-SHELL-002 — header (Day N · date), TodayExerciseCard/FoodCard/MilestoneCard, summary + settings exits
- SettingsScreen.tsx      CMP-SHELL-003 — sections in CONTRACT §5 order
- sections/ProfileSection.tsx   height, units, baseline weight (converted for display)
- sections/DisplaySection.tsx   showCalorieEstimates toggle
- sections/SafetySection.tsx    symptom alert level 0–10 with Clear action
- sections/AboutSection.tsx     HEALTH_DISCLAIMER_TEXT, LOCK_NOTE_TEXT, ESTIMATE_DISCLAIMER_TEXT, version
- index.ts                barrel: AppProviders, TodayScreen, SettingsScreen, OnboardingScreen, SetupGate, bootstrapApp
- __tests__/bootstrap.test.ts   API-SHELL-001 resilience (11 tests)
- __tests__/onboarding.test.tsx CMP-SHELL-004 step logic (9 tests)
- __tests__/today.test.tsx      CMP-SHELL-002 composition (3 tests)
- __tests__/settings.test.tsx   CMP-SHELL-003 sections (6 tests)
- __tests__/routes.test.ts      GAT-051 static route-table audit (26 routes + layout + tab order) (19 tests)

src/app/
- _layout.tsx             root Stack inside AppProviders + SetupGate, all stack titles, useReminderNotificationRouting()
- (tabs)/_layout.tsx      five tabs in order, text glyph icons
- (tabs)/index.tsx, exercises.tsx, food.tsx, photos.tsx, progress.tsx
- onboarding.tsx, settings.tsx
- exercise/new.tsx, exercise/[exerciseId].tsx
- session/run.tsx, session/complete/[sessionId].tsx, session/history.tsx, session/[sessionId].tsx
- food/capture.tsx, food/entry/[entryId].tsx, food/categories.tsx
- photos/capture.tsx, photos/compare/[journeyId]/[milestoneDay].tsx, photos/timeline/[journeyId].tsx, photos/journeys.tsx
- measurements.tsx, journal/index.tsx, journal/[entryId].tsx
- summary/[date].tsx (invalid date → EmptyState)
- backup.tsx

README.md                 rewritten — What it is, safety boundary, requirements, setup & run, APK install, permissions, privacy, AI analysis, backup/restore, reminders, journeys, testing, known limitations

## Files touched outside stage 7 (integration fixes)

src/modules/progress/index.ts         — added missing `DailySummaryScreen` export (screen existed, index never exported it; CONTRACT §4's summary/[date] row had nothing to import)
src/modules/progress/screens/DailySummaryScreen.tsx — renamed prop `localDate` → `date` to match CONTRACT §4 (`{ date: LocalDate }`); no tests reference it

## Test results

- typecheck: silent
- lint: silent (0 errors)
- jest: 717 / 717 passing, 45 suites (shell tests: 100 / 100)

## Assumptions

- Tab icons are text glyphs (● ▲ ■ ◆ ✦) since no icon font is a dependency; CONTRACT leaves icon choice to A7 ("or text-only if unsure").
- `Switch` from react-native is used for the display toggle (no Switch exists in the shared UI kit; Stage 1 is frozen, so no shared component was added).
- Onboarding height entry is always centimetres even in imperial units (conversion UI lives in Settings per the unit-workaround already in Stage 6's ProfileSection pattern).
- RNTL in this build cannot dispatch wrapped `Pressable` onPress via `fireEvent.press`; press-driven interactions in onboarding tests are asserted through repository mocks instead.

## Deviations from the pack

None beyond the two integration fixes above; both are required for CONTRACT §4 to be satisfiable and are recorded here.

## Verified commands

npm run typecheck   silent
npm run lint        silent (warnings only)
npx jest            717/717 passing, 0 failures

## Questions for the user

None blocking.
