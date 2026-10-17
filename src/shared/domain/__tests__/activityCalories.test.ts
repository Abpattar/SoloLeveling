/** @jest-environment node */
import { estimateExerciseKcal, estimateSessionKcal } from '../activityCalories';
import { INTENSITY_MET } from '../../constants/text';
import type { SessionExerciseResult } from '../../types/training';

describe('estimateExerciseKcal (API-ACT-001, GAT-031)', () => {
  it('uses round(MET x kg x activeSeconds / 3600) with the contract MET values', () => {
    expect(INTENSITY_MET).toEqual({ light: 2.5, moderate: 3.5, vigorous: 5.0 });
    // moderate 3.5 MET x 70 kg x 1800 s / 3600 = 122.5 -> 123
    expect(estimateExerciseKcal({ intensity: 'moderate', weightKg: 70, activeSeconds: 1800 })).toBe(123);
    expect(estimateExerciseKcal({ intensity: 'light', weightKg: 60, activeSeconds: 3600 })).toBe(150);
    expect(estimateExerciseKcal({ intensity: 'vigorous', weightKg: 80, activeSeconds: 600 })).toBe(67);
  });

  it('returns null without an intensity, a weight, or a positive duration', () => {
    expect(estimateExerciseKcal({ intensity: null, weightKg: 70, activeSeconds: 600 })).toBeNull();
    expect(estimateExerciseKcal({ intensity: 'light', weightKg: null, activeSeconds: 600 })).toBeNull();
    expect(estimateExerciseKcal({ intensity: 'light', weightKg: 70, activeSeconds: 0 })).toBeNull();
    expect(estimateExerciseKcal({ intensity: 'light', weightKg: 70, activeSeconds: -10 })).toBeNull();
    expect(estimateExerciseKcal({ intensity: 'light', weightKg: 0, activeSeconds: 600 })).toBeNull();
  });
});

describe('estimateSessionKcal (API-ACT-002)', () => {
  const result = (
    intensity: SessionExerciseResult['intensity'],
    activeSeconds: number,
  ): Pick<SessionExerciseResult, 'intensity' | 'activeSeconds'> => ({ intensity, activeSeconds });

  it('sums only the exercises with enough information', () => {
    // moderate 3.5 MET x 70 kg x 600 s / 3600 = 40.83 -> 41; light 2.5 -> 29.17 -> 29.
    expect(
      estimateSessionKcal([result('moderate', 600), result(null, 900), result('light', 600)], 70),
    ).toBe(70);
  });

  it('returns null when no exercise qualified', () => {
    expect(estimateSessionKcal([result(null, 600), result(null, 900)], 70)).toBeNull();
    expect(estimateSessionKcal([result('light', 600)], null)).toBeNull();
    expect(estimateSessionKcal([], 70)).toBeNull();
  });
});