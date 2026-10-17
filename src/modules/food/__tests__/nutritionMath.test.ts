/** @jest-environment node */
import { scaleNutrition, sumNutrition } from '../domain/nutritionMath';
import type { NutritionValues } from '@/shared/types/food';

const values = (patch: Partial<NutritionValues> = {}): NutritionValues => ({
  caloriesKcal: null,
  proteinGrams: null,
  carbsGrams: null,
  fatGrams: null,
  ...patch,
});

describe('sumNutrition (API-FOOD-019)', () => {
  it('adds calories and protein, treating null protein as zero', () => {
    const total = sumNutrition([
      values({ caloriesKcal: 450, proteinGrams: 12 }),
      values({ caloriesKcal: 300, proteinGrams: null }),
    ]);
    expect(total.caloriesKcal).toBe(750);
    expect(total.proteinGrams).toBe(12);
  });

  it('keeps carbs and fat null when no entry supplied them', () => {
    const total = sumNutrition([values({ caloriesKcal: 100, proteinGrams: 5 })]);
    expect(total.carbsGrams).toBeNull();
    expect(total.fatGrams).toBeNull();
  });

  it('sums macros when at least one entry supplied them', () => {
    const total = sumNutrition([
      values({ caloriesKcal: 100, carbsGrams: 10, fatGrams: 2 }),
      values({ caloriesKcal: 100, carbsGrams: null, fatGrams: 3 }),
    ]);
    expect(total.carbsGrams).toBe(10);
    expect(total.fatGrams).toBe(5);
  });

  it('returns all zeros for an empty list', () => {
    expect(sumNutrition([])).toEqual({
      caloriesKcal: 0,
      proteinGrams: 0,
      carbsGrams: null,
      fatGrams: null,
    });
  });

  it('treats a null calorie as zero rather than dropping the entry', () => {
    const total = sumNutrition([
      values({ caloriesKcal: null, proteinGrams: 8 }),
      values({ caloriesKcal: 200, proteinGrams: 4 }),
    ]);
    expect(total.caloriesKcal).toBe(200);
    expect(total.proteinGrams).toBe(12);
  });
});

describe('scaleNutrition (API-FOOD-020)', () => {
  it('rounds calories to whole numbers', () => {
    expect(scaleNutrition(values({ caloriesKcal: 333 }), 0.5).caloriesKcal).toBe(167);
    expect(scaleNutrition(values({ caloriesKcal: 333 }), 1.5).caloriesKcal).toBe(500);
  });

  it('rounds grams to one decimal place', () => {
    expect(scaleNutrition(values({ proteinGrams: 11.37 }), 1.5).proteinGrams).toBe(17.1);
    expect(scaleNutrition(values({ proteinGrams: 10 }), 0.75).proteinGrams).toBe(7.5);
  });

  it('keeps nulls null', () => {
    expect(scaleNutrition(values(), 2)).toEqual({
      caloriesKcal: null,
      proteinGrams: null,
      carbsGrams: null,
      fatGrams: null,
    });
  });

  it('caps at the CONTRACT §7 limits instead of storing an impossible value', () => {
    expect(scaleNutrition(values({ caloriesKcal: 4999 }), 2).caloriesKcal).toBe(5000);
    expect(scaleNutrition(values({ proteinGrams: 299 }), 4).proteinGrams).toBe(300);
  });

  it('round trips a scale of 1', () => {
    const input = values({ caloriesKcal: 421, proteinGrams: 18.4, carbsGrams: 30, fatGrams: 12 });
    expect(scaleNutrition(input, 1)).toEqual(input);
  });
});