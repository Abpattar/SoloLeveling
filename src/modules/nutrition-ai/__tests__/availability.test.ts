/** @jest-environment node */
import { createTestDb } from '@/shared/db/testing/createTestDb';
import { setDbForTesting } from '@/shared/db/database';
import { updateSettings } from '@/shared/settings/settingsRepository';
import { getAnalysisAvailability } from '../availability';
import { AI_PROVIDER_CATALOG } from '../providers/catalog';

const mockStore = new Map<string, string>();

jest.mock('@/shared/platform/secureStorage', () => ({
  getSecret: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setSecret: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  }),
  deleteSecret: jest.fn(async (key: string) => {
    mockStore.delete(key);
  }),
}));

const CONSENT_AT = '2026-10-01T00:00:00.000Z';

async function enableEverything(overrides: Record<string, unknown> = {}): Promise<void> {
  await updateSettings({
    ai: {
      externalAnalysisEnabled: true,
      providerId: 'groq',
      consentGrantedAt: CONSENT_AT,
      consentProviderId: 'groq',
      consentDisclosureVersion: 1,
      modelOverride: null,
      ...overrides,
    },
  });
}

beforeEach(async () => {
  setDbForTesting(await createTestDb());
  mockStore.clear();
});

afterEach(() => {
  setDbForTesting(null);
});

describe('getAnalysisAvailability (API-AI-001, GAT-015)', () => {
  it('is disabled with default settings, whatever the key state (GAT-013)', async () => {
    mockStore.set('ai.apiKey.groq', 'sk-test');
    expect(await getAnalysisAvailability()).toEqual({ state: 'disabled' });
  });

  it('is no_provider once enabled without a provider', async () => {
    await updateSettings({ ai: { externalAnalysisEnabled: true, providerId: null } });
    expect(await getAnalysisAvailability()).toEqual({ state: 'no_provider' });
  });

  it('is no_consent when enabled with a provider but no consent', async () => {
    await updateSettings({
      ai: {
        externalAnalysisEnabled: true,
        providerId: 'groq',
        consentGrantedAt: null,
        consentProviderId: null,
        consentDisclosureVersion: null,
      },
    });
    expect(await getAnalysisAvailability()).toEqual({ state: 'no_consent' });
  });

  it('is no_api_key when consented but the key is missing', async () => {
    await enableEverything();
    expect(await getAnalysisAvailability()).toEqual({ state: 'no_api_key' });
  });

  it('is ready only when everything is in place', async () => {
    await enableEverything();
    mockStore.set('ai.apiKey.groq', 'sk-test');
    expect(await getAnalysisAvailability()).toEqual({ state: 'ready', providerId: 'groq' });
  });

  it('voids consent when the provider changed', async () => {
    await enableEverything();
    mockStore.set('ai.apiKey.groq', 'sk-test');
    mockStore.set('ai.apiKey.gemini', 'sk-test');
    await updateSettings({ ai: { providerId: 'gemini' } });
    expect(await getAnalysisAvailability()).toEqual({ state: 'no_consent' });
  });

  it('voids consent when the disclosure version changed', async () => {
    await enableEverything({ consentDisclosureVersion: 0 });
    mockStore.set('ai.apiKey.groq', 'sk-test');
    expect(await getAnalysisAvailability()).toEqual({ state: 'no_consent' });
  });

  it('treats a blank key as missing', async () => {
    await enableEverything();
    mockStore.set('ai.apiKey.groq', '   ');
    expect(await getAnalysisAvailability()).toEqual({ state: 'no_api_key' });
  });

  it('follows the documented order: disabled wins over everything else', async () => {
    await updateSettings({
      ai: {
        externalAnalysisEnabled: false,
        providerId: 'groq',
        consentGrantedAt: CONSENT_AT,
        consentProviderId: 'groq',
        consentDisclosureVersion: 1,
      },
    });
    mockStore.set('ai.apiKey.groq', 'sk-test');
    expect(await getAnalysisAvailability()).toEqual({ state: 'disabled' });
  });
});

describe('AI_PROVIDER_CATALOG (API-AI-003)', () => {
  it('contains exactly groq and gemini', () => {
    expect(AI_PROVIDER_CATALOG.map((p) => p.id)).toEqual(['groq', 'gemini']);
  });

  it('carries the disclosure version, urls and verification date', () => {
    for (const provider of AI_PROVIDER_CATALOG) {
      expect(provider.disclosureVersion).toBe(1);
      expect(provider.verifiedOn).toBe('2026-10-11');
      expect(provider.docsUrl.startsWith('https://')).toBe(true);
      expect(provider.apiKeyUrl.startsWith('https://')).toBe(true);
      expect(provider.defaultModelId.length).toBeGreaterThan(0);
    }
  });

  it('states both providers retain or may use data', () => {
    const groq = AI_PROVIDER_CATALOG.find((p) => p.id === 'groq');
    const gemini = AI_PROVIDER_CATALOG.find((p) => p.id === 'gemini');
    expect(groq?.dataHandlingSummary).toMatch(/30 days/);
    expect(gemini?.dataHandlingSummary).toMatch(/human reviewers/);
    for (const provider of AI_PROVIDER_CATALOG) {
      expect(provider.dataHandlingSummary).toMatch(/sent to/);
    }
  });
});