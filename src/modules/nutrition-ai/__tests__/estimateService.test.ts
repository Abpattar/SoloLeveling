/** @jest-environment node */
import { createTestDb } from '@/shared/db/testing/createTestDb';
import { setDbForTesting } from '@/shared/db/database';
import { updateSettings } from '@/shared/settings/settingsRepository';
import { estimateNutritionFromImage, assertPrivateFoodPhoto } from '../estimateService';

const mockStore = new Map<string, string>();
const mockFetch = jest.fn();
const mockPrepare = jest.fn(async (_uri: string) => ({
  base64: 'QUJD',
  mimeType: 'image/jpeg' as const,
}));
let mockPhotoRoot = 'file:///data/user/0/app/files/private-media/';

jest.mock('@/shared/platform/secureStorage', () => ({
  getSecret: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setSecret: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  }),
  deleteSecret: jest.fn(async (key: string) => {
    mockStore.delete(key);
  }),
}));

jest.mock('@/shared/files/photoStorage', () => ({
  getPhotoRootUri: () => mockPhotoRoot,
  resolvePhotoUri: (p: string) => {
    // Mirrors the real photoStorage path check, including the `..` rejection (SEC-10).
    if (p.includes('..') || p.includes('\\') || p.includes('://')) {
      throw new Error('bad relative path');
    }
    const segments = p.split('/');
    if (segments.length !== 2 || (segments[0] !== 'food' && segments[0] !== 'progress')) {
      throw new Error('bad relative path');
    }
    return `${mockPhotoRoot}${p}`;
  },
}));

jest.mock('../imagePrep', () => ({
  prepareImageForAnalysis: (uri: string) => mockPrepare(uri),
}));

// INTERNAL-WORKAROUND: a global `fetch` spy keeps the assertion "fetch was never called" honest
// without patching the httpClient module itself.
beforeEach(() => {
  (globalThis as { fetch?: unknown }).fetch = mockFetch;
});

const CONSENT_AT = '2026-10-01T00:00:00.000Z';

function reply(body: unknown, ok = true, status = 200): Response {
  const text = JSON.stringify(body);
  return {
    status,
    ok,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(text),
  } as unknown as Response;
}

const validReply = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          not_food: false,
          description: 'Dosa',
          items: [{ name: 'Dosa', calories_kcal: 250, protein_g: 6 }],
          totals: { calories_kcal: 280, protein_g: 7, carbs_g: 40, fat_g: 9 },
          confidence: 'medium',
          clarification: null,
        }),
      },
    },
  ],
};

async function enableEverything(provider: 'groq' | 'gemini' = 'groq'): Promise<void> {
  await updateSettings({
    ai: {
      externalAnalysisEnabled: true,
      providerId: provider,
      consentGrantedAt: CONSENT_AT,
      consentProviderId: provider,
      consentDisclosureVersion: 1,
      modelOverride: null,
    },
  });
  mockStore.set(`ai.apiKey.${provider}`, 'sk-test-key');
}

beforeEach(async () => {
  setDbForTesting(await createTestDb());
  mockStore.clear();
  mockFetch.mockReset();
  mockPrepare.mockClear();
  mockPhotoRoot = 'file:///data/user/0/app/files/private-media/';
});

afterEach(() => {
  setDbForTesting(null);
});

describe('assertPrivateFoodPhoto (SEC-04, GAT-017)', () => {
  it('accepts a private food photo', () => {
    expect(() =>
      assertPrivateFoodPhoto(`${mockPhotoRoot}food/abc.jpg`),
    ).not.toThrow();
  });

  it.each([
    'file:///data/user/0/app/files/private-media/progress/abc.jpg',
    'file:///data/user/0/app/files/private-media/food/../../secrets',
    'file:///data/user/0/app/files/private-media/',
    'file:///data/user/0/app/files/private-media/food/',
    'content://media/external/images/1.jpg',
    'https://example.com/photo.jpg',
    'file:///storage/emulated/0/DCIM/photo.jpg',
  ])('rejects %s', (uri) => {
    expect(() => assertPrivateFoodPhoto(uri)).toThrow();
  });
});

describe('estimateNutritionFromImage (API-AI-002)', () => {
  it('makes no request at all with default settings (GAT-013)', async () => {
    mockStore.set('ai.apiKey.groq', 'sk-test-key');
    const result = await estimateNutritionFromImage({
      imageUri: `${mockPhotoRoot}food/abc.jpg`,
    });
    expect(result.ok).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockPrepare).not.toHaveBeenCalled();
  });

  it('makes no request when consented but the key is missing', async () => {
    await updateSettings({
      ai: {
        externalAnalysisEnabled: true,
        providerId: 'groq',
        consentGrantedAt: CONSENT_AT,
        consentProviderId: 'groq',
        consentDisclosureVersion: 1,
      },
    });
    const result = await estimateNutritionFromImage({ imageUri: `${mockPhotoRoot}food/abc.jpg` });
    expect(result.ok).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it.each([
    ['a progress photo', 'progress/abc.jpg'],
    ['a gallery photo', '../../DCIM/photo.jpg'],
    ['a remote url', null],
  ])('refuses %s with VALIDATION and never calls fetch (GAT-017)', async (_name, path) => {
    await enableEverything();
    const imageUri = path === null ? 'https://example.com/p.jpg' : `${mockPhotoRoot}${path}`;
    const result = await estimateNutritionFromImage({ imageUri });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION');
    }
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockPrepare).not.toHaveBeenCalled();
  });

  it('returns a validated estimate for groq', async () => {
    await enableEverything('groq');
    mockFetch.mockResolvedValue(reply(validReply));

    const result = await estimateNutritionFromImage({
      imageUri: `${mockPhotoRoot}food/abc.jpg`,
      mealCategoryName: 'Lunch',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.providerId).toBe('groq');
      expect(result.value.modelId).toBe('qwen/qwen3.8-27b');
      expect(result.value.nutrition.caloriesKcal).toBe(280);
      expect(result.value.notFood).toBe(false);
    }
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns a validated estimate for gemini', async () => {
    await enableEverything('gemini');
    mockFetch.mockResolvedValue(
      reply({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    totals: { calories_kcal: 150, protein_g: 4, carbs_g: 30, fat_g: 2 },
                    confidence: 'low',
                  }),
                },
              ],
            },
          },
        ],
      }),
    );

    const result = await estimateNutritionFromImage({ imageUri: `${mockPhotoRoot}food/abc.jpg` });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.providerId).toBe('gemini');
      expect(result.value.nutrition.caloriesKcal).toBe(150);
    }
  });

  it('honours a model override', async () => {
    await enableEverything();
    await updateSettings({ ai: { modelOverride: 'my/custom-model' } });
    mockFetch.mockResolvedValue(reply(validReply));
    const result = await estimateNutritionFromImage({ imageUri: `${mockPhotoRoot}food/abc.jpg` });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.modelId).toBe('my/custom-model');
    }
  });

  it('reports notFood without failing', async () => {
    await enableEverything();
    mockFetch.mockResolvedValue(
      reply({
        choices: [
          {
            message: {
              content: JSON.stringify({ not_food: true, description: 'a shoe', items: [] }),
            },
          },
        ],
      }),
    );
    const result = await estimateNutritionFromImage({ imageUri: `${mockPhotoRoot}food/abc.jpg` });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.notFood).toBe(true);
      expect(result.value.nutrition.caloriesKcal).toBeNull();
    }
  });

  it('maps 429 to RATE_LIMITED', async () => {
    await enableEverything();
    mockFetch.mockResolvedValue(reply({ error: { message: 'rate' } }, false, 429));
    const result = await estimateNutritionFromImage({ imageUri: `${mockPhotoRoot}food/abc.jpg` });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('RATE_LIMITED');
    }
  });

  it('maps 500 to PROVIDER_ERROR and hides the response body', async () => {
    await enableEverything();
    mockFetch.mockResolvedValue(
      reply({ error: { message: 'INTERNAL_SECRET_DETAIL' } }, false, 500),
    );
    const result = await estimateNutritionFromImage({ imageUri: `${mockPhotoRoot}food/abc.jpg` });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PROVIDER_ERROR');
      expect(result.error.message).not.toContain('INTERNAL_SECRET_DETAIL');
    }
  });

  it('maps 401 to a message about the key, without echoing the key', async () => {
    await enableEverything();
    mockFetch.mockResolvedValue(reply({}, false, 401));
    const result = await estimateNutritionFromImage({ imageUri: `${mockPhotoRoot}food/abc.jpg` });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PROVIDER_ERROR');
      expect(result.error.message).not.toContain('sk-test-key');
    }
  });

  it('maps a missing connection to OFFLINE', async () => {
    await enableEverything();
    mockFetch.mockRejectedValue(new TypeError('Network request failed'));
    const result = await estimateNutritionFromImage({ imageUri: `${mockPhotoRoot}food/abc.jpg` });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('OFFLINE');
    }
  });

  it('maps garbage from the provider to PARSE_ERROR', async () => {
    await enableEverything();
    mockFetch.mockResolvedValue(reply({ choices: [{ message: { content: 'not json at all' } }] }));
    const result = await estimateNutritionFromImage({ imageUri: `${mockPhotoRoot}food/abc.jpg` });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PARSE_ERROR');
    }
  });

  it('maps a caller abort to CANCELLED', async () => {
    await enableEverything();
    const controller = new AbortController();
    mockFetch.mockImplementation(async () => {
      controller.abort();
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    });
    const result = await estimateNutritionFromImage({
      imageUri: `${mockPhotoRoot}food/abc.jpg`,
      signal: controller.signal,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('CANCELLED');
    }
  });

  it('never lets the API key appear in a returned message (GAT-019)', async () => {
    await enableEverything();
    mockFetch.mockRejectedValue(new TypeError('boom'));
    const result = await estimateNutritionFromImage({ imageUri: `${mockPhotoRoot}food/abc.jpg` });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('sk-test-key');
  });

  it('sends exactly one request with exactly one image', async () => {
    await enableEverything();
    mockFetch.mockResolvedValue(reply(validReply));
    await estimateNutritionFromImage({ imageUri: `${mockPhotoRoot}food/abc.jpg` });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, { body: string; headers: Record<string, string> }];
    expect(url.startsWith('https://api.groq.com/')).toBe(true);
    const body = JSON.parse(init.body);
    expect(JSON.stringify(body).match(/data:image\/jpeg;base64/g)).toHaveLength(1);
    expect(init.headers.Authorization).toBe('Bearer sk-test-key');
  });
});