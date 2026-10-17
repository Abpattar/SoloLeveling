/**
 * INTEGRATION CONTRACT: API-SHELL-001
 * Purpose: the startup sequence must never be the reason a user cannot open the app. Only the
 *          database may reject; reminders and photo analysis failures are logged, not thrown.
 */
import { AppState } from 'react-native';
import { resetBootstrapForTesting } from '../bootstrap';

jest.mock('../../shared/db/database', () => ({
  getDb: jest.fn(async () => ({ name: 'test-db' })),
}));

jest.mock('../../modules/reminders', () => ({
  initializeReminders: jest.fn(async () => undefined),
}));

jest.mock('../../modules/food', () => ({
  setEstimatorBridge: jest.fn(),
  processPendingAnalyses: jest.fn(async () => ({ processed: 0, failed: 0 })),
}));

jest.mock('../../modules/nutrition-ai', () => ({
  getAnalysisAvailability: jest.fn(async () => ({ state: 'disabled' })),
  estimateNutritionFromImage: jest.fn(async () => ({ ok: false, error: new Error('unused') })),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports -- pulled in after the mocks above.
import { bootstrapApp } from '../bootstrap';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import { getDb } from '../../shared/db/database';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import { initializeReminders } from '../../modules/reminders';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import { processPendingAnalyses, setEstimatorBridge } from '../../modules/food';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import { estimateNutritionFromImage, getAnalysisAvailability } from '../../modules/nutrition-ai';

const getDbMock = getDb as jest.MockedFunction<typeof getDb>;
const initializeRemindersMock = initializeReminders as jest.MockedFunction<typeof initializeReminders>;
const processPendingAnalysesMock = processPendingAnalyses as jest.MockedFunction<
  typeof processPendingAnalyses
>;
const setEstimatorBridgeMock = setEstimatorBridge as jest.MockedFunction<typeof setEstimatorBridge>;
const getAnalysisAvailabilityMock = getAnalysisAvailability as jest.MockedFunction<
  typeof getAnalysisAvailability
>;
const estimateNutritionFromImageMock = estimateNutritionFromImage as jest.MockedFunction<
  typeof estimateNutritionFromImage
>;

describe('bootstrapApp (API-SHELL-001)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetBootstrapForTesting();
    getDbMock.mockResolvedValue({ name: 'test-db' } as any);
    initializeRemindersMock.mockResolvedValue(undefined);
    processPendingAnalysesMock.mockResolvedValue({ processed: 0, failed: 0 });
  });

  it('opens the database first', async () => {
    await bootstrapApp();
    expect(getDbMock).toHaveBeenCalledTimes(1);
  });

  it('wires the nutrition estimator into the food bridge', async () => {
    await bootstrapApp();
    expect(setEstimatorBridgeMock).toHaveBeenCalledTimes(1);
    const bridge = setEstimatorBridgeMock.mock.calls[0]?.[0];
    expect(bridge).not.toBeNull();
    expect(bridge?.getAnalysisAvailability).toBe(getAnalysisAvailabilityMock);
    expect(bridge?.estimateNutritionFromImage).toBe(estimateNutritionFromImageMock);
  });

  it('processes queued analyses once at startup', async () => {
    await bootstrapApp();
    expect(processPendingAnalysesMock).toHaveBeenCalledTimes(1);
  });

  it('installs a foreground listener', async () => {
    const spy = jest.spyOn(AppState, 'addEventListener');
    await bootstrapApp();
    expect(spy).toHaveBeenCalledWith('change', expect.any(Function));
    spy.mockRestore();
  });

  it('only runs the sequence once, even if called twice', async () => {
    await bootstrapApp();
    await bootstrapApp();
    expect(getDbMock).toHaveBeenCalledTimes(1);
    expect(initializeRemindersMock).toHaveBeenCalledTimes(1);
  });

  it('still resolves when reminders fail', async () => {
    initializeRemindersMock.mockRejectedValue(new Error('no notification permission'));
    await expect(bootstrapApp()).resolves.toBeUndefined();
    expect(processPendingAnalysesMock).toHaveBeenCalledTimes(1);
  });

  it('still resolves when queued analyses fail', async () => {
    processPendingAnalysesMock.mockRejectedValue(new Error('analysis crashed'));
    await expect(bootstrapApp()).resolves.toBeUndefined();
  });

  it('rejects when the database cannot be opened', async () => {
    getDbMock.mockRejectedValue(new Error('database is corrupt'));
    await expect(bootstrapApp()).rejects.toThrow('database is corrupt');
  });

  it('can be retried after a database failure', async () => {
    getDbMock.mockRejectedValueOnce(new Error('database is corrupt'));
    await expect(bootstrapApp()).rejects.toThrow('database is corrupt');

    getDbMock.mockResolvedValue({ name: 'test-db' } as any);
    await expect(bootstrapApp()).resolves.toBeUndefined();
    expect(initializeRemindersMock).toHaveBeenCalledTimes(1);
  });
});
