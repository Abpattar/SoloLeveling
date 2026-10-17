/**
 * INTEGRATION CONTRACT: GAT-051
 * Purpose: static proof that SHARED_CONTRACT §4's route table is actually on disk and wires the
 *          component it names. Route files are thin wrappers, so a missing or renamed import is the
 *          only way the table can silently rot; this reads the files instead of rendering them.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const APP_DIR = join(__dirname, '..', '..', 'app');

/** [route file under src/app/, component it must import] - SHARED_CONTRACT.md §4, verbatim. */
const ROUTE_TABLE: Array<[string, string]> = [
  ['(tabs)/index.tsx', 'TodayScreen'],
  ['(tabs)/exercises.tsx', 'ExerciseListScreen'],
  ['(tabs)/food.tsx', 'FoodLogScreen'],
  ['(tabs)/photos.tsx', 'PhotosHomeScreen'],
  ['(tabs)/progress.tsx', 'ProgressScreen'],
  ['onboarding.tsx', 'OnboardingScreen'],
  ['settings.tsx', 'SettingsScreen'],
  ['exercise/new.tsx', 'ExerciseEditorScreen'],
  ['exercise/[exerciseId].tsx', 'ExerciseEditorScreen'],
  ['session/run.tsx', 'SessionRunScreen'],
  ['session/complete/[sessionId].tsx', 'SessionCompleteScreen'],
  ['session/history.tsx', 'SessionHistoryScreen'],
  ['session/[sessionId].tsx', 'SessionDetailScreen'],
  ['food/capture.tsx', 'FoodCaptureScreen'],
  ['food/entry/[entryId].tsx', 'FoodEntryScreen'],
  ['food/categories.tsx', 'MealCategoriesScreen'],
  ['photos/capture.tsx', 'ProgressPhotoCaptureScreen'],
  ['photos/compare/[journeyId]/[milestoneDay].tsx', 'PhotoComparisonScreen'],
  ['photos/timeline/[journeyId].tsx', 'PhotoTimelineScreen'],
  ['photos/journeys.tsx', 'JourneysScreen'],
  ['measurements.tsx', 'MeasurementsScreen'],
  ['journal/index.tsx', 'JournalScreen'],
  ['journal/[entryId].tsx', 'JournalEntryScreen'],
  ['summary/[date].tsx', 'DailySummaryScreen'],
  ['backup.tsx', 'BackupScreen'],
];

function readRoute(relativePath: string): string {
  return readFileSync(join(APP_DIR, relativePath), 'utf8');
}

describe('SHARED_CONTRACT §4 route table (GAT-051)', () => {
  it.each(ROUTE_TABLE)('%s exists', (relativePath) => {
    expect(existsSync(join(APP_DIR, relativePath))).toBe(true);
  });

  it.each(ROUTE_TABLE)('%s imports %s', (relativePath, component) => {
    expect(readRoute(relativePath)).toContain(component);
  });

  it('every route file is a thin wrapper, not a place for business logic', () => {
    // SHARED_CONTRACT §4: "Route files are ≤ 15 lines: parse params, render the component."
    for (const [relativePath] of ROUTE_TABLE) {
      const codeLines = readRoute(relativePath)
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('//') && !line.startsWith('*'));
      expect({ file: relativePath, codeLines: codeLines.length }).toEqual({
        file: relativePath,
        codeLines: expect.any(Number),
      });
      expect(codeLines.length).toBeLessThanOrEqual(15);
    }
  });

  it('the root layout composes providers, gate and reminder routing', () => {
    const layout = readRoute('_layout.tsx');
    expect(layout).toContain('AppProviders');
    expect(layout).toContain('SetupGate');
    expect(layout).toContain('useReminderNotificationRouting');
    expect(layout).toContain('<Stack');
  });

  it('the root layout gives every non-tab route a title', () => {
    const layout = readRoute('_layout.tsx');
    const screens = ROUTE_TABLE.map(([file]) => file.replace(/\.tsx$/, '')).filter(
      (name) => !name.startsWith('(tabs)'),
    );
    for (const screen of screens) {
      expect({ screen, titled: layout.includes(`name="${screen}"`) }).toEqual({
        screen,
        titled: true,
      });
    }
  });

  it('the tab layout declares the five tabs in order', () => {
    const layout = readRoute('(tabs)/_layout.tsx');
    const order = ['index', 'exercises', 'food', 'photos', 'progress'];
    const positions = order.map((name) => layout.indexOf(`'${name}'`));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('route files never import a module internal file', () => {
    for (const [relativePath] of ROUTE_TABLE) {
      const text = readRoute(relativePath);
      const internals = text.match(/@\/modules\/[a-z-]+\/(?!index)[a-zA-Z/]+/g);
      expect({ file: relativePath, internals: internals ?? [] }).toEqual({
        file: relativePath,
        internals: [],
      });
    }
  });
});
