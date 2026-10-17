/** @jest-environment node */
import { createTestDb } from '../../db/testing/createTestDb';
import { getDb, setDbForTesting } from '../../db/database';
import {
  acknowledgeDisclaimer,
  completeOnboarding,
  getProfile,
  updateProfile,
} from '../profileRepository';
import { getReferenceWeightKg } from '../referenceWeight';

beforeEach(async () => {
  setDbForTesting(await createTestDb());
});

afterEach(() => {
  setDbForTesting(null);
});

describe('getProfile (API-SET-001)', () => {
  it('creates a default row on first read and reuses it afterwards', async () => {
    const first = await getProfile();
    expect(first.heightCm).toBeNull();
    expect(first.unitSystem).toBe('metric');
    expect(first.baselineWeightKg).toBeNull();
    expect(first.onboardingCompleted).toBe(false);
    expect(first.disclaimerAcknowledgedAt).toBeNull();

    const second = await getProfile();
    expect(second.createdAt).toBe(first.createdAt);
  });
});

describe('updateProfile (API-SET-002)', () => {
  it('stores height, units and baseline weight', async () => {
    const updated = await updateProfile({
      heightCm: 170,
      unitSystem: 'metric',
      baselineWeightKg: 72.5,
    });
    expect(updated.heightCm).toBe(170);
    expect(updated.baselineWeightKg).toBe(72.5);
  });

  it('rejects out-of-range height and weight and writes nothing', async () => {
    await getProfile();
    await expect(updateProfile({ heightCm: 30 })).rejects.toThrow();
    await expect(updateProfile({ heightCm: 400 })).rejects.toThrow();
    await expect(updateProfile({ baselineWeightKg: 5 })).rejects.toThrow();
    await expect(updateProfile({ baselineWeightKg: 500 })).rejects.toThrow();
    const unchanged = await getProfile();
    expect(unchanged.heightCm).toBeNull();
    expect(unchanged.baselineWeightKg).toBeNull();
  });

  it('accepts boundary values', async () => {
    const updated = await updateProfile({ heightCm: 50, baselineWeightKg: 20 });
    expect(updated.heightCm).toBe(50);
    expect(updated.baselineWeightKg).toBe(20);
  });

  it('leaves untouched fields alone', async () => {
    await updateProfile({ heightCm: 165 });
    const updated = await updateProfile({ unitSystem: 'imperial' });
    expect(updated.heightCm).toBe(165);
    expect(updated.unitSystem).toBe('imperial');
  });
});

describe('onboarding and disclaimer (API-SET-003, API-SET-004)', () => {
  it('records the disclaimer once and completes onboarding', async () => {
    const acknowledged = await acknowledgeDisclaimer();
    expect(acknowledged.disclaimerAcknowledgedAt).not.toBeNull();
    const again = await acknowledgeDisclaimer();
    expect(again.disclaimerAcknowledgedAt).toBe(acknowledged.disclaimerAcknowledgedAt);

    const done = await completeOnboarding();
    expect(done.onboardingCompleted).toBe(true);
  });
});

describe('getReferenceWeightKg (API-ACT-003)', () => {
  it('returns null when nothing is known', async () => {
    expect(await getReferenceWeightKg()).toBeNull();
  });

  it('falls back to the profile baseline weight', async () => {
    await updateProfile({ baselineWeightKg: 70 });
    expect(await getReferenceWeightKg()).toBe(70);
  });

  it('prefers the latest weight measurement and converts lb to kg', async () => {
    await updateProfile({ baselineWeightKg: 70 });

    const handle = await getDb();
    await handle.execute(
      `INSERT INTO measurements (id, type, value, unit, measured_at, local_date, created_at)
       VALUES (?, 'weight', ?, 'lb', ?, ?, ?)`,
      ['m1', 154.323583526, '2026-10-01T05:00:00.000Z', '2026-10-01', '2026-10-01T05:00:00.000Z'],
    );
    await handle.execute(
      `INSERT INTO measurements (id, type, value, unit, measured_at, local_date, created_at)
       VALUES (?, 'weight', ?, 'kg', ?, ?, ?)`,
      ['m2', 69.5, '2026-10-05T05:00:00.000Z', '2026-10-05', '2026-10-05T05:00:00.000Z'],
    );
    expect(await getReferenceWeightKg()).toBe(69.5);
  });
});