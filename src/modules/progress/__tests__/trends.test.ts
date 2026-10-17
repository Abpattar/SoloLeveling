import { addDays } from '@/shared/utils/dates';
import { exerciseConsistencyByWeek, weeklyNutritionAverages } from '../domain/trends';
import type { DailyNutritionTotals } from '@/shared/types/food';

function day(localDate: string, caloriesKcal: number, entryCount = 1): DailyNutritionTotals {
  const total = { caloriesKcal, proteinGrams: 100, carbsGrams: 120, fatGrams: 50 };
  return {
    localDate,
    total,
    bySource: { ai_estimate: total, confirmed: total, manual: total },
    mealSubtotals: [],
    entryCount,
    entriesWithoutValues: 0,
  };
}
describe('weeklyNutritionAverages', () => {
  it('is empty for no days', () => {
    expect(weeklyNutritionAverages([])).toEqual([]);
  });

  it('averages only days that have at least one entry', () => {
    const weekly = weeklyNutritionAverages([
      day('2026-03-02', 2000),
      day('2026-03-03', 0),
      day('2026-03-04', 2400),
    ]);

    expect(weekly).toHaveLength(1);
    expect(weekly[0]?.key).toBe('2026-W10');
    expect(weekly[0]?.averageCaloriesKcal).toBe(2200);
    expect(weekly[0]?.daysCounted).toBe(2);
  });

  it('keys weeks across a year boundary', () => {
    const weekly = weeklyNutritionAverages([day('2025-12-29', 2000), day('2026-01-05', 2100)]);

    expect(weekly.map((w) => w.key)).toEqual(['2026-W01', '2026-W02']);
  });
});

describe('exerciseConsistencyByWeek', () => {
  const from = '2026-03-02';
  const to = '2026-03-15';

  it('is empty when nothing was completed', () => {
    expect(exerciseConsistencyByWeek({}, from, to)).toEqual([]);
  });

  it('counts sessions and days per ISO week', () => {
    const counts: Record<string, number> = {
      '2026-03-02': 1,
      '2026-03-03': 2,
      '2026-03-09': 1,
    };

    const weeks = exerciseConsistencyByWeek(counts, from, to);
    expect(weeks.map((w) => w.key)).toEqual(['2026-W10', '2026-W11']);
    expect(weeks[0]?.completedSessions).toBe(3);
    expect(weeks[0]?.daysWithSession).toBe(2);
    expect(weeks[1]?.completedSessions).toBe(1);
    expect(weeks[1]?.daysWithSession).toBe(1);
  });

  it('ignores counts outside the range', () => {
    const weeks = exerciseConsistencyByWeek({ '2026-02-01': 5 }, from, to);

    expect(weeks).toEqual([]);
  });

  it('returns weeks in ascending order', () => {
    const weeks = exerciseConsistencyByWeek(
      { '2026-03-09': 1, '2026-03-02': 1 },
      from,
      to,
    );

    expect(weeks.map((w) => w.key)).toEqual(['2026-W10', '2026-W11']);
  });

  it('lists no weeks when the whole range is empty, so the screen shows its empty state', () => {
    const counts: Record<string, number> = {};

    expect(exerciseConsistencyByWeek(counts, addDays(from, 0), addDays(from, 13))).toEqual([]);
  });
});