/** @jest-environment node */
import { fail, ok } from '@/shared/errors/result';
import {
  estimateNutritionFromImageSafe,
  getAnalysisAvailabilitySafe,
  isEstimatorAttached,
  setEstimatorBridge,
} from '../services/estimatorBridge';
import type { EstimatorBridge } from '../services/estimatorBridge';
import type { NutritionEstimate } from '@/shared/types/nutritionAi';

const estimate: NutritionEstimate = {
  description: 'Dosa',
  items: [],
  portionText: null,
  nutrition: { caloriesKcal: 250, proteinGrams: 6, carbsGrams: 30, fatGrams: 8 },
  confidence: 'low',
  clarification: null,
  providerId: 'groq',
  modelId: 'm',
  notFood: false,
};

function bridge(overrides: Partial<EstimatorBridge> = {}): EstimatorBridge {
  return {
    getAnalysisAvailability: async () => ({ state: 'ready' as const, providerId: 'groq' as const }),
    estimateNutritionFromImage: jest.fn(async () => ok(estimate)),
    ...overrides,
  };
}

afterEach(() => {
  setEstimatorBridge(null);
});

describe('with no bridge attached', () => {
  it('reports analysis as disabled, never as an error', async () => {
    setEstimatorBridge(null);
    expect(isEstimatorAttached()).toBe(false);
    expect(await getAnalysisAvailabilitySafe()).toEqual({ state: 'disabled' });
  });

  it('reports NOT_CONFIGURED instead of throwing', async () => {
    const result = await estimateNutritionFromImageSafe({ imageUri: 'file:///food/a.jpg' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_CONFIGURED');
    }
  });
});

describe('with a bridge attached', () => {
  it('passes availability straight through', async () => {
    setEstimatorBridge(bridge());
    expect(isEstimatorAttached()).toBe(true);
    expect(await getAnalysisAvailabilitySafe()).toEqual({ state: 'ready', providerId: 'groq' });
  });

  it('degrades to disabled when availability itself throws', async () => {
    setEstimatorBridge(
      bridge({
        getAnalysisAvailability: jest.fn(async () => {
          throw new Error('secure store unavailable');
        }),
      }),
    );
    expect(await getAnalysisAvailabilitySafe()).toEqual({ state: 'disabled' });
  });

  it('returns a successful result unchanged', async () => {
    setEstimatorBridge(bridge());
    const result = await estimateNutritionFromImageSafe({ imageUri: 'file:///food/a.jpg' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(estimate);
    }
  });

  it('passes an estimator failure through without changing it', async () => {
    setEstimatorBridge(bridge({ estimateNutritionFromImage: async () => fail('RATE_LIMITED', 'slow') }));
    const result = await estimateNutritionFromImageSafe({ imageUri: 'file:///food/a.jpg' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('RATE_LIMITED');
    }
  });

  it('converts a thrown transport error into a retryable NETWORK failure', async () => {
    setEstimatorBridge(
      bridge({
        estimateNutritionFromImage: jest.fn(async () => {
          throw new Error('socket hang up');
        }),
      }),
    );
    const result = await estimateNutritionFromImageSafe({ imageUri: 'file:///food/a.jpg' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // NETWORK is in RETRYABLE_CODES, so the entry stays `pending` and is retried later.
      expect(result.error.code).toBe('NETWORK');
    }
  });
});