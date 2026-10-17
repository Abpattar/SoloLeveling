/** @jest-environment node */
import { createTestDb } from '../../db/testing/createTestDb';
import { getDb, setDbForTesting } from '../../db/database';
import { appEvents } from '../../events/appEvents';
import { getSettings, resetAiConsent, updateSettings } from '../settingsRepository';
import { DEFAULT_APP_SETTINGS } from '../../constants/settings';

beforeEach(async () => {
  setDbForTesting(await createTestDb());
});

afterEach(() => {
  setDbForTesting(null);
});

describe('getSettings (API-SET-005)', () => {
  it('returns defaults when nothing is stored', async () => {
    expect(await getSettings()).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('merges stored values over defaults so new keys still appear', async () => {
    await updateSettings({ display: { showCalorieEstimates: false } });
    const stored = await getSettings();
    expect(stored.display.showCalorieEstimates).toBe(false);
    // Everything else still comes from the defaults.
    expect(stored.reminders.exercise.timeLocal).toBe('08:00');
    expect(stored.ai.externalAnalysisEnabled).toBe(false);
  });

  it('falls back to defaults when the stored JSON is corrupt', async () => {
    const handle = await getDb();
    await handle.execute(
      'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
      ['app', '{not json', 'now'],
    );
    expect(await getSettings()).toEqual(DEFAULT_APP_SETTINGS);
  });
});

describe('updateSettings (API-SET-006)', () => {
  it('deep-merges a partial patch', async () => {
    await updateSettings({ safety: { painAlertLevel: 7 } });
    const settings = await updateSettings({ reminders: { exercise: { enabled: true } } });
    expect(settings.safety.painAlertLevel).toBe(7);
    expect(settings.reminders.exercise.enabled).toBe(true);
    expect(settings.reminders.exercise.timeLocal).toBe('08:00');
  });

  it('emits settings.changed with the touched top-level keys', async () => {
    const handler = jest.fn();
    const off = appEvents.on('settings.changed', handler);
    await updateSettings({ nutrition: { targetCaloriesKcal: 1800 } });
    expect(handler).toHaveBeenCalledWith({ keys: ['nutrition'] });
    off();
  });

  it('rejects an out-of-range pain alert level and writes nothing', async () => {
    await expect(updateSettings({ safety: { painAlertLevel: 11 } })).rejects.toThrow();
    await expect(updateSettings({ safety: { painAlertLevel: 2.5 } })).rejects.toThrow();
    expect((await getSettings()).safety.painAlertLevel).toBeNull();
  });

  it('accepts boundary pain alert levels 0 and 10 and null', async () => {
    expect((await updateSettings({ safety: { painAlertLevel: 0 } })).safety.painAlertLevel).toBe(0);
    expect((await updateSettings({ safety: { painAlertLevel: 10 } })).safety.painAlertLevel).toBe(10);
    expect((await updateSettings({ safety: { painAlertLevel: null } })).safety.painAlertLevel).toBeNull();
  });

  it('rejects non-positive nutrition targets', async () => {
    await expect(updateSettings({ nutrition: { targetCaloriesKcal: 0 } })).rejects.toThrow();
    await expect(updateSettings({ nutrition: { targetProteinGrams: -5 } })).rejects.toThrow();
  });

  it('rejects malformed reminder times', async () => {
    await expect(
      updateSettings({ reminders: { exercise: { timeLocal: '8:00' } } }),
    ).rejects.toThrow();
    await expect(
      updateSettings({ reminders: { exercise: { timeLocal: '25:00' } } }),
    ).rejects.toThrow();
  });

  it('rejects an unknown provider id', async () => {
    await expect(updateSettings({ ai: { providerId: 'openai' as never } })).rejects.toThrow();
  });

  it('rejects an empty model override', async () => {
    await expect(updateSettings({ ai: { modelOverride: '   ' } })).rejects.toThrow();
  });
});

describe('resetAiConsent (API-SET-007)', () => {
  it('clears the AI block but keeps other settings', async () => {
    await updateSettings({
      ai: {
        externalAnalysisEnabled: true,
        providerId: 'groq',
        consentGrantedAt: '2026-10-01T00:00:00.000Z',
        consentProviderId: 'groq',
        consentDisclosureVersion: 1,
        modelOverride: 'my-model',
      },
      nutrition: { targetProteinGrams: 90 },
    });

    const after = await resetAiConsent();
    expect(after.ai).toEqual(DEFAULT_APP_SETTINGS.ai);
    expect(after.nutrition.targetProteinGrams).toBe(90);
  });
});