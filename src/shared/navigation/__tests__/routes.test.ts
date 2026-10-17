/** @jest-environment node */
import { ROUTES } from '../routes';

describe('ROUTES (CONST-NAV-001)', () => {
  it('exposes exactly the keys required by CONTRACT §4', () => {
    expect(Object.keys(ROUTES).sort()).toEqual(
      [
        'onboarding',
        'today',
        'exercises',
        'food',
        'photos',
        'progress',
        'settings',
        'exerciseNew',
        'exerciseEdit',
        'sessionRun',
        'sessionComplete',
        'sessionHistory',
        'sessionDetail',
        'foodCapture',
        'foodEntry',
        'mealCategories',
        'photoCapture',
        'photoCompare',
        'photoTimeline',
        'journeys',
        'measurements',
        'journal',
        'journalEntry',
        'dailySummary',
        'backup',
      ].sort(),
    );
  });

  it('uses the fixed literal paths', () => {
    expect(ROUTES.onboarding).toBe('/onboarding');
    expect(ROUTES.today).toBe('/');
    expect(ROUTES.exercises).toBe('/exercises');
    expect(ROUTES.food).toBe('/food');
    expect(ROUTES.photos).toBe('/photos');
    expect(ROUTES.progress).toBe('/progress');
    expect(ROUTES.settings).toBe('/settings');
    expect(ROUTES.exerciseNew).toBe('/exercise/new');
    expect(ROUTES.sessionHistory).toBe('/session/history');
    expect(ROUTES.mealCategories).toBe('/food/categories');
    expect(ROUTES.journeys).toBe('/photos/journeys');
    expect(ROUTES.measurements).toBe('/measurements');
    expect(ROUTES.journal).toBe('/journal');
    expect(ROUTES.backup).toBe('/backup');
  });

  it('builds parameterised paths', () => {
    expect(ROUTES.exerciseEdit('abc')).toBe('/exercise/abc');
    expect(ROUTES.sessionComplete('s1')).toBe('/session/complete/s1');
    expect(ROUTES.sessionDetail('s1')).toBe('/session/s1');
    expect(ROUTES.foodEntry('e1')).toBe('/food/entry/e1');
    expect(ROUTES.photoTimeline('j1')).toBe('/photos/timeline/j1');
    expect(ROUTES.photoCompare('j1', 30)).toBe('/photos/compare/j1/30');
    expect(ROUTES.dailySummary('2026-10-12')).toBe('/summary/2026-10-12');
    expect(ROUTES.journalEntry('new')).toBe('/journal/new');
  });

  it('omits optional query strings when no value is given', () => {
    expect(ROUTES.sessionRun()).toBe('/session/run');
    expect(ROUTES.sessionRun([])).toBe('/session/run');
    expect(ROUTES.foodCapture()).toBe('/food/capture');
    expect(ROUTES.photoCapture()).toBe('/photos/capture');
  });

  it('adds optional query strings when a value is given', () => {
    expect(ROUTES.sessionRun(['a', 'b'])).toBe('/session/run?ids=a,b');
    expect(ROUTES.foodCapture('meal-lunch')).toBe('/food/capture?mealCategoryId=meal-lunch');
    expect(ROUTES.photoCapture('s1')).toBe('/photos/capture?sessionId=s1');
  });

  it('URL-encodes ids so a route can never break out of its segment', () => {
    expect(ROUTES.exerciseEdit('a/b?c')).toBe('/exercise/a%2Fb%3Fc');
    expect(ROUTES.photoCompare('j 1', 60)).toBe('/photos/compare/j%201/60');
    expect(ROUTES.sessionRun(['a b', 'c'])).toBe('/session/run?ids=a%20b,c');
  });
});