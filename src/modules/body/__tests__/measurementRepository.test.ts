/** @jest-environment node */
import { createTestDb } from '@/shared/db/testing/createTestDb';
import { setDbForTesting } from '@/shared/db/database';
import { AppError } from '@/shared/errors/AppError';
import { addDays } from '@/shared/utils/dates';
import {
  addMeasurement,
  deleteMeasurement,
  getWeightSeriesKg,
  listMeasurements,
  updateMeasurement,
} from '../data/measurementRepository';

beforeEach(async () => {
  setDbForTesting(await createTestDb());
});

function at(date: string, time = '08:00'): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

describe('measurementRepository.addMeasurement', () => {
  it('stores a weight entry and derives localDate from measuredAt', async () => {
    const saved = await addMeasurement({
      type: 'weight',
      value: 80,
      unit: 'kg',
      customLabel: null,
      measuredAt: at('2026-03-10'),
      note: null,
    });

    expect(saved.localDate).toBe('2026-03-10');
    expect(saved.value).toBe(80);
    expect(saved.unit).toBe('kg');
  });

  it('rejects a non-positive value', async () => {
    await expect(
      addMeasurement({
        type: 'weight',
        value: 0,
        unit: 'kg',
        customLabel: null,
        measuredAt: at('2026-03-10'),
        note: null,
      }),
    ).rejects.toThrow(AppError);
  });

  it('rejects a non-finite value', async () => {
    await expect(
      addMeasurement({
        type: 'weight',
        value: Number.NaN,
        unit: 'kg',
        customLabel: null,
        measuredAt: at('2026-03-10'),
        note: null,
      }),
    ).rejects.toThrow(AppError);
  });

  it('rejects an empty unit', async () => {
    await expect(
      addMeasurement({
        type: 'weight',
        value: 80,
        unit: '',
        customLabel: null,
        measuredAt: at('2026-03-10'),
        note: null,
      }),
    ).rejects.toThrow(AppError);
  });

  it('rejects a unit longer than 12 characters', async () => {
    await expect(
      addMeasurement({
        type: 'weight',
        value: 80,
        unit: 'a'.repeat(13),
        customLabel: null,
        measuredAt: at('2026-03-10'),
        note: null,
      }),
    ).rejects.toThrow(AppError);
  });

  it('rejects a weight outside 20-400 kg', async () => {
    await expect(
      addMeasurement({
        type: 'weight',
        value: 19,
        unit: 'kg',
        customLabel: null,
        measuredAt: at('2026-03-10'),
        note: null,
      }),
    ).rejects.toThrow(AppError);
    await expect(
      addMeasurement({
        type: 'weight',
        value: 401,
        unit: 'kg',
        customLabel: null,
        measuredAt: at('2026-03-10'),
        note: null,
      }),
    ).rejects.toThrow(AppError);
  });

  it('rejects a weight with an unknown unit because it cannot be validated', async () => {
    await expect(
      addMeasurement({
        type: 'weight',
        value: 80,
        unit: 'stone',
        customLabel: null,
        measuredAt: at('2026-03-10'),
        note: null,
      }),
    ).rejects.toThrow(AppError);
  });

  it('accepts the same weight expressed in lb', async () => {
    const saved = await addMeasurement({
      type: 'weight',
      value: 176,
      unit: 'lb',
      customLabel: null,
      measuredAt: at('2026-03-10'),
      note: null,
    });

    expect(saved.unit).toBe('lb');
  });

  it('requires a customLabel for the custom type', async () => {
    await expect(
      addMeasurement({
        type: 'custom',
        value: 30,
        unit: 'cm',
        customLabel: null,
        measuredAt: at('2026-03-10'),
        note: null,
      }),
    ).rejects.toThrow(AppError);
  });

  it('ignores a customLabel for non-custom types', async () => {
    const saved = await addMeasurement({
      type: 'waist',
      value: 80,
      unit: 'cm',
      customLabel: 'ignored',
      measuredAt: at('2026-03-10'),
      note: null,
    });

    expect(saved.customLabel).toBeNull();
  });

  it('rejects a customLabel longer than 40 characters', async () => {
    await expect(
      addMeasurement({
        type: 'custom',
        value: 30,
        unit: 'cm',
        customLabel: 'a'.repeat(41),
        measuredAt: at('2026-03-10'),
        note: null,
      }),
    ).rejects.toThrow(AppError);
  });

  it('rejects a measuredAt in the future', async () => {
    const tomorrow = addDays(new Date().toISOString().slice(0, 10), 1);
    await expect(
      addMeasurement({
        type: 'weight',
        value: 80,
        unit: 'kg',
        customLabel: null,
        measuredAt: at(tomorrow),
        note: null,
      }),
    ).rejects.toThrow(AppError);
  });

  it('defaults measuredAt to now', async () => {
    const saved = await addMeasurement({ type: 'weight', value: 80, unit: 'kg' });

    expect(Date.parse(saved.measuredAt)).toBeLessThanOrEqual(Date.now() + 1000);
  });
});

describe('measurementRepository list and weight series', () => {
  it('returns measurements date-ascending', async () => {
    await addMeasurement({ type: 'weight', value: 80, unit: 'kg', measuredAt: at('2026-03-12') });
    await addMeasurement({ type: 'weight', value: 81, unit: 'kg', measuredAt: at('2026-03-10') });
    await addMeasurement({ type: 'weight', value: 82, unit: 'kg', measuredAt: at('2026-03-11') });

    const all = await listMeasurements();
    expect(all.map((m) => m.localDate)).toEqual(['2026-03-10', '2026-03-11', '2026-03-12']);
  });

  it('filters by type and by date range', async () => {
    await addMeasurement({ type: 'weight', value: 80, unit: 'kg', measuredAt: at('2026-03-01') });
    await addMeasurement({ type: 'waist', value: 85, unit: 'cm', measuredAt: at('2026-03-02') });
    await addMeasurement({ type: 'weight', value: 79, unit: 'kg', measuredAt: at('2026-03-05') });

    expect((await listMeasurements({ type: 'waist' })).length).toBe(1);

    const inRange = await listMeasurements({ from: '2026-03-02', to: '2026-03-04' });
    expect(inRange.map((m) => m.localDate)).toEqual(['2026-03-02']);
  });

  it('getWeightSeriesKg keeps only the latest entry per date, in kg', async () => {
    await addMeasurement({ type: 'weight', value: 80, unit: 'kg', measuredAt: at('2026-03-10', '07:00') });
    await addMeasurement({ type: 'weight', value: 81, unit: 'kg', measuredAt: at('2026-03-10', '20:00') });
    await addMeasurement({ type: 'weight', value: 176, unit: 'lb', measuredAt: at('2026-03-11', '08:00') });

    const series = await getWeightSeriesKg();
    expect(series).toHaveLength(2);
    expect(series[0]?.valueKg).toBe(81);
    expect(series[1]?.localDate).toBe('2026-03-11');
    expect(series[1]?.valueKg).toBeCloseTo(79.83, 2);
  });

  it('getWeightSeriesKg honours the date range', async () => {
    await addMeasurement({ type: 'weight', value: 80, unit: 'kg', measuredAt: at('2026-03-01') });
    await addMeasurement({ type: 'weight', value: 79, unit: 'kg', measuredAt: at('2026-03-05') });

    const series = await getWeightSeriesKg({ from: '2026-03-02', to: '2026-03-31' });
    expect(series.map((p) => p.localDate)).toEqual(['2026-03-05']);
  });

  it('getWeightSeriesKg returns an empty series when nothing is recorded', async () => {
    expect(await getWeightSeriesKg()).toEqual([]);
  });
});

describe('measurementRepository update and delete', () => {
  it('updates a stored measurement', async () => {
    const saved = await addMeasurement({ type: 'weight', value: 80, unit: 'kg' });

    const updated = await updateMeasurement(saved.id, {
      type: 'weight',
      value: 79.5,
      unit: 'kg',
      customLabel: null,
      measuredAt: saved.measuredAt,
      note: 'after a rest day',
    });

    expect(updated.value).toBe(79.5);
    expect(updated.note).toBe('after a rest day');
  });

  it('rejects an update of an unknown id', async () => {
    await expect(
      updateMeasurement('missing', {
        type: 'weight',
        value: 80,
        unit: 'kg',
        customLabel: null,
        measuredAt: at('2026-03-10'),
        note: null,
      }),
    ).rejects.toThrow(AppError);
  });

  it('deletes a measurement', async () => {
    const saved = await addMeasurement({ type: 'weight', value: 80, unit: 'kg' });

    await deleteMeasurement(saved.id);

    expect(await listMeasurements()).toEqual([]);
  });

  it('rejects a delete of an unknown id', async () => {
    await expect(deleteMeasurement('missing')).rejects.toThrow(AppError);
  });
});