/** @jest-environment node */
import { createTestDb } from '@/shared/db/testing/createTestDb';
import { setDbForTesting } from '@/shared/db/database';
import { AppError } from '@/shared/errors/AppError';
import { addMeasurement } from '@/modules/body';
import { createJournalEntry } from '@/modules/journal';
import { getDailySummary } from '../services/dailySummary';
import type { NutritionTotals, DailyNutritionTotals } from '@/shared/types/food';
import type { Session, SessionStatus } from '@/shared/types/training';

const mockSettings = {
  nutrition: { targetCaloriesKcal: 2200, targetProteinGrams: 140 },
  safety: { painAlertLevel: 6 },
};
let mockTotals: DailyNutritionTotals = emptyTotals('2026-03-10');
let mockScheduled: unknown[] = [];
let mockSessions: Session[] = [];

/** Local wall-clock time on that date, so the stored local date is stable in any timezone. */
function at(date: string, time: string): string {
  return new Date(date + 'T' + time + ':00').toISOString();
}

function emptyTotals(localDate: string): DailyNutritionTotals {
  const total: NutritionTotals = {
    caloriesKcal: 0,
    proteinGrams: 0,
    carbsGrams: 0,
    fatGrams: 0,
  };
  return {
    localDate,
    total,
    bySource: { ai_estimate: total, confirmed: total, manual: total },
    mealSubtotals: [],
    entryCount: 0,
    entriesWithoutValues: 0,
  };
}

function totalsWith(
  localDate: string,
  caloriesKcal: number,
  proteinGrams: number,
): DailyNutritionTotals {
  const base = emptyTotals(localDate);
  const total: NutritionTotals = {
    caloriesKcal,
    proteinGrams,
    carbsGrams: 220,
    fatGrams: 60,
  };
  return {
    ...base,
    total,
    bySource: { ai_estimate: total, confirmed: total, manual: total },
    entryCount: 3,
  };
}

jest.mock('@/shared/settings/settingsRepository', () => ({
  getSettings: jest.fn(async () => mockSettings),
}));

jest.mock('@/modules/food', () => ({
  getDailyNutritionTotals: jest.fn(async () => mockTotals),
}));

jest.mock('@/modules/training', () => ({
  listExercisesScheduledFor: jest.fn(async () => mockScheduled),
  listSessionsForDate: jest.fn(async () => mockSessions),
  getCompletedSessionCountsByDate: jest.fn(async () => ({})),
}));

function session(id: string, status: SessionStatus, estimatedKcal: number | null): Session {
  return {
    id,
    localDate: '2026-03-10',
    startedAt: at('2026-03-10', '17:00'),
    endedAt: at('2026-03-10', '17:30'),
    status,
    totalDurationSeconds: 1800,
    effortRating: null,
    notes: null,
    painScore: null,
    symptomFlags: [],
    estimatedKcal,
    results: [],
    createdAt: at('2026-03-10', '17:00'),
  };
}

beforeEach(async () => {
  setDbForTesting(await createTestDb());
  mockTotals = emptyTotals('2026-03-10');
  mockScheduled = [];
  mockSessions = [];
});

describe('getDailySummary', () => {
  it('rejects a malformed date', async () => {
    await expect(getDailySummary('10-03-2026' as never)).rejects.toThrow(AppError);
  });

  it('returns zeros and nulls for an empty day', async () => {
    const summary = await getDailySummary('2026-03-10');

    expect(summary.nutrition.total.caloriesKcal).toBe(0);
    expect(summary.weightKg).toBeNull();
    expect(summary.estimatedWorkoutKcal).toBeNull();
    expect(summary.measurements).toEqual([]);
    expect(summary.journalEntries).toEqual([]);
    expect(summary.sessions).toEqual([]);
    expect(summary.scheduledExerciseCount).toBe(0);
  });

  it('assembles food, exercise, weight and journal for a full day', async () => {
    mockTotals = totalsWith('2026-03-10', 2100, 130);
    mockScheduled = [{ id: 'e1' }, { id: 'e2' }];
    mockSessions = [session('s1', 'completed', 200)];
    await addMeasurement({
      type: 'weight',
      value: 80,
      unit: 'kg',
      measuredAt: at('2026-03-10', '08:00'),
    });
    await createJournalEntry({
      localDate: '2026-03-10',
      painScore: 2,
      stiffnessScore: null,
      swellingLevel: null,
      symptomFlags: [],
      notes: null,
    });

    const summary = await getDailySummary('2026-03-10');

    expect(summary.nutrition.total.caloriesKcal).toBe(2100);
    expect(summary.nutrition.total.proteinGrams).toBe(130);
    expect(summary.targets.caloriesKcal).toBe(2200);
    expect(summary.targets.proteinGrams).toBe(140);
    expect(summary.scheduledExerciseCount).toBe(2);
    expect(summary.estimatedWorkoutKcal).toBe(200);
    expect(summary.weightKg).toBeCloseTo(80, 6);
    expect(summary.journalEntries).toHaveLength(1);
  });

  it('converts a weight recorded in lb to kg', async () => {
    await addMeasurement({
      type: 'weight',
      value: 176,
      unit: 'lb',
      measuredAt: at('2026-03-10', '08:00'),
    });

    expect((await getDailySummary('2026-03-10')).weightKg).toBeCloseTo(79.83, 2);
  });

  it('sums only the completed sessions', async () => {
    mockSessions = [session('s1', 'completed', 200), session('s2', 'stopped', 150)];

    expect((await getDailySummary('2026-03-10')).estimatedWorkoutKcal).toBe(200);
  });

  it('reports no workout calories when a completed session has none', async () => {
    mockSessions = [session('s1', 'completed', null)];

    expect((await getDailySummary('2026-03-10')).estimatedWorkoutKcal).toBeNull();
  });

  it('never adds workout calories to food intake (GAT-030)', async () => {
    mockTotals = totalsWith('2026-03-10', 2000, 120);
    mockSessions = [session('s1', 'completed', 300)];

    const summary = await getDailySummary('2026-03-10');

    // The nutrition figure stays exactly what food recorded; the workout figure sits beside it.
    expect(summary.nutrition.total.caloriesKcal).toBe(2000);
    expect(summary.estimatedWorkoutKcal).toBe(300);
  });

  it('keeps non-weight measurements and reports no weight when only those exist', async () => {
    await addMeasurement({
      type: 'waist',
      value: 84,
      unit: 'cm',
      measuredAt: at('2026-03-10', '08:00'),
    });

    const summary = await getDailySummary('2026-03-10');

    expect(summary.weightKg).toBeNull();
    expect(summary.measurements).toHaveLength(1);
  });

  it('takes the latest weight of the day', async () => {
    await addMeasurement({
      type: 'weight',
      value: 80,
      unit: 'kg',
      measuredAt: at('2026-03-10', '07:00'),
    });
    await addMeasurement({
      type: 'weight',
      value: 79.5,
      unit: 'kg',
      measuredAt: at('2026-03-10', '19:00'),
    });

    expect((await getDailySummary('2026-03-10')).weightKg).toBeCloseTo(79.5, 6);
  });

  it('ignores a weight recorded on another day', async () => {
    await addMeasurement({
      type: 'weight',
      value: 80,
      unit: 'kg',
      measuredAt: at('2026-03-11', '08:00'),
    });

    expect((await getDailySummary('2026-03-10')).weightKg).toBeNull();
  });
});