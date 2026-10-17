# FILE_OWNERSHIP_MAP.md (includes the project directory tree)

**Version 1.0.** Every file has exactly ONE owner. Owners: **A1** Foundation · **A2** Training+Reminders · **A3** Food · **A4** Nutrition AI+Backup · **A5** Photos+Journeys · **A6** Body+Journal+Progress · **A7** Shell. Responsibilities and exports per file are in each agent prompt's file table and in the registry's "Defined in" paths. Tests (`__tests__/`) are owned by the agent that owns the code under test. All paths are relative to the project root; deliverables must use these exact paths.

```
/ (project root)
├── package.json  app.json  tsconfig.json  babel.config.js  jest.config.js  jest.setup.ts   [A1]
├── eslint.config.js  .prettierrc.json  .gitignore                                          [A1]
├── README.md                                                                               [A7]
├── docs/modules/<module>.md   (optional one-page note per module)                          [owner of module]
├── scripts/check-contract.mjs  INTEGRATION_*.md  FINAL_INTEGRATION_REPORT.md               [OpenCode only]
└── src/
    ├── app/                                   (expo-router routes, CONTRACT §4)             [A7]
    │   ├── _layout.tsx  onboarding.tsx  settings.tsx  measurements.tsx  backup.tsx
    │   ├── (tabs)/_layout.tsx  index.tsx  exercises.tsx  food.tsx  photos.tsx  progress.tsx
    │   ├── exercise/new.tsx  exercise/[exerciseId].tsx
    │   ├── session/run.tsx  session/history.tsx  session/[sessionId].tsx  session/complete/[sessionId].tsx
    │   ├── food/capture.tsx  food/categories.tsx  food/entry/[entryId].tsx
    │   ├── photos/capture.tsx  photos/journeys.tsx  photos/timeline/[journeyId].tsx
    │   ├── photos/compare/[journeyId]/[milestoneDay].tsx
    │   ├── journal/index.tsx  journal/[entryId].tsx
    │   └── summary/[date].tsx
    ├── shell/                                                                               [A7]
    │   ├── index.ts  AppProviders.tsx  bootstrap.ts  SetupGate.tsx  TodayScreen.tsx
    │   ├── OnboardingScreen.tsx  SettingsScreen.tsx
    │   ├── sections/ProfileSection.tsx  DisplaySection.tsx  SafetySection.tsx  AboutSection.tsx
    │   └── __tests__/routes.test.ts  today.test.tsx
    ├── shared/                                                                              [A1]
    │   ├── types/  common.ts profile.ts settings.ts safety.ts training.ts food.ts nutritionAi.ts photos.ts body.ts journal.ts summary.ts backup.ts events.ts
    │   ├── errors/  AppError.ts  result.ts
    │   ├── constants/  text.ts  settings.ts
    │   ├── utils/  dates.ts  ids.ts  units.ts  logger.ts
    │   ├── db/  types.ts  database.ts  migrations.ts  testing/createTestDb.ts
    │   ├── events/appEvents.ts
    │   ├── files/photoStorage.ts
    │   ├── platform/secureStorage.ts
    │   ├── data/  profileRepository.ts  referenceWeight.ts
    │   ├── settings/  settingsRepository.ts  SettingsProvider.tsx
    │   ├── domain/  activityCalories.ts  safety.ts
    │   ├── navigation/routes.ts
    │   ├── ui/  theme.ts Screen.tsx AppText.tsx Button.tsx Card.tsx fields.tsx Chip.tsx feedback.tsx confirmAction.ts useFocusLoad.ts PhotoCapture.tsx safetyUi.tsx
    │   └── **/__tests__/*.test.ts(x)
    └── modules/
        ├── training/                                                                        [A2]
        │   ├── index.ts
        │   ├── data/  exerciseRepository.ts  sessionRepository.ts
        │   ├── domain/  sessionMachine.ts  validation.ts
        │   ├── hooks/useSessionRunner.ts
        │   ├── screens/  ExerciseListScreen.tsx ExerciseEditorScreen.tsx SessionRunScreen.tsx SessionCompleteScreen.tsx SessionHistoryScreen.tsx SessionDetailScreen.tsx
        │   ├── components/  TodayExerciseCard.tsx  ExerciseForm.tsx
        │   └── __tests__/  exerciseRepository.test.ts sessionRepository.test.ts sessionMachine.test.ts validation.test.ts
        ├── reminders/                                                                       [A2]
        │   ├── index.ts  types.ts  notifications.ts  scheduler.ts  reminderService.ts
        │   ├── useReminderNotificationRouting.ts  ReminderSettingsSection.tsx
        │   └── __tests__/  scheduler.test.ts  reminderService.test.ts
        ├── food/                                                                            [A3]
        │   ├── index.ts
        │   ├── data/  mealCategoryRepository.ts  foodRows.ts  foodRepository.ts
        │   ├── domain/  nutritionMath.ts  totals.ts
        │   ├── services/analysisService.ts
        │   ├── screens/  FoodLogScreen.tsx FoodCaptureScreen.tsx FoodEntryScreen.tsx MealCategoriesScreen.tsx
        │   ├── components/  TodayFoodCard.tsx NutritionTargetsSettingsSection.tsx EntryCard.tsx NutritionBadge.tsx
        │   └── __tests__/  nutritionMath.test.ts totals.test.ts foodRepository.test.ts analysisService.test.ts mealCategoryRepository.test.ts
        ├── nutrition-ai/                                                                    [A4]
        │   ├── index.ts  availability.ts  estimateService.ts  prompt.ts  parseEstimate.ts  imagePrep.ts  httpClient.ts
        │   ├── providers/  types.ts  catalog.ts  groqAdapter.ts  geminiAdapter.ts
        │   ├── AnalysisSettingsSection.tsx
        │   └── __tests__/  parseEstimate.test.ts availability.test.ts estimateService.test.ts adapters.test.ts
        ├── backup/                                                                          [A4]
        │   ├── index.ts  manifest.ts  backupFs.ts  exporter.ts  restorer.ts  BackupScreen.tsx  BackupSettingsSection.tsx
        │   └── __tests__/  manifest.test.ts  restorer.test.ts
        ├── photos/                                                                          [A5]
        │   ├── index.ts
        │   ├── domain/  milestones.ts  photoViews.ts
        │   ├── data/  journeyRepository.ts  photoRepository.ts
        │   ├── services/photoExport.ts
        │   ├── hooks/useActiveJourney.ts
        │   ├── screens/  PhotosHomeScreen.tsx ProgressPhotoCaptureScreen.tsx PhotoComparisonScreen.tsx PhotoTimelineScreen.tsx JourneysScreen.tsx
        │   ├── components/  TodayMilestoneCard.tsx ProgressPhotoPromptCard.tsx JourneySettingsSection.tsx MilestoneCard.tsx PhotoGrid.tsx
        │   └── __tests__/  milestones.test.ts photoViews.test.ts journeyRepository.test.ts photoRepository.test.ts
        ├── body/                                                                            [A6]
        │   ├── index.ts  data/measurementRepository.ts  domain/weightSeries.ts
        │   ├── screens/MeasurementsScreen.tsx  components/MeasurementForm.tsx
        │   └── __tests__/  measurementRepository.test.ts  weightSeries.test.ts
        ├── journal/                                                                         [A6]
        │   ├── index.ts  data/journalRepository.ts  screens/JournalScreen.tsx JournalEntryScreen.tsx
        │   └── __tests__/journalRepository.test.ts
        └── progress/                                                                        [A6]
            ├── index.ts  services/dailySummary.ts  domain/trends.ts
            ├── charts/LineChart.tsx  BarChart.tsx
            ├── screens/ProgressScreen.tsx  DailySummaryScreen.tsx
            └── __tests__/  dailySummary.test.ts  trends.test.ts
```

## Ownership rules
1. Never create or edit a file you do not own. If you need a change in another owner's file, record a CHANGE in `NEW_SYMBOLS.md`.
2. `package.json` is A1's alone. Other agents list needed packages in `DEPENDENCIES.md` (must be within the approved list in CONTRACT §1).
3. Shared types are copied verbatim by A1 from CONTRACT §3; nobody else declares them or re-declares look-alikes.
4. Extra internal helper files inside your own module directory are allowed (list them in your handover); new top-level directories and new files under `src/shared` are not (A1 only).
5. Each module `index.ts` re-exports exactly the registry symbols for that module (plus nothing else); internals stay private.
