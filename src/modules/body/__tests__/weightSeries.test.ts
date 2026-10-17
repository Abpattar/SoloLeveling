import { addDays } from '@/shared/utils/dates';
import {
  changeFromBaseline,
  monthlyAverages,
  movingAverage,
  weeklyAverages,
} from '../domain/weightSeries';
import type { WeightPoint } from '@/shared/types/body';

function point(localDate: string, valueKg: number): WeightPoint {
  return { localDate, valueKg };
}

function series(...values: Array<[string, number]>): WeightPoint[] {
  return values.map(([localDate, valueKg]) => point(localDate, valueKg));
}

describe('movingAverage', () => {
  it('averages a single point', () => {
    expect(movingAverage(series(['2026-03-01', 80]), 7)).toEqual([{ localDate: '2026-03-01', valueKg: 80 }]);
  });

  it('averages the trailing window, returning one value per point', () => {
    const points = series(
      ['2026-03-01', 80],
      ['2026-03-02', 81],
      ['2026-03-03', 82],
    );

    expect(movingAverage(points, 2).map((p) => p.valueKg)).toEqual([80, 80.5, 81.5]);
  });

  it('averages by date, so a gap drops old points instead of shifting the window', () => {
    const points = series(
      ['2026-03-01', 80],
      ['2026-03-02', 81],
      ['2026-03-10', 82],
    );

    const averaged = movingAverage(points, 7);
    expect(averaged.map((p) => p.localDate)).toEqual(['2026-03-01', '2026-03-02', '2026-03-10']);
    // 03-10 is 8 days after 03-02, so only its own point is inside the 7-day window.
    expect(averaged[2]?.valueKg).toBe(82);
    expect(averaged[1]?.valueKg).toBe(80.5);
  });

  it('keeps a point that is 6 days old inside a 7-day window', () => {
    const points = series(['2026-03-04', 80], ['2026-03-10', 82]);

    expect(movingAverage(points, 7)[1]?.valueKg).toBe(81);
  });

  it('handles a large gap by returning the point unchanged', () => {
    const points = series(['2026-03-01', 80], ['2026-03-20', 82]);

    const averaged = movingAverage(points, 7);
    expect(averaged[1]?.valueKg).toBe(82);
    expect(averaged[0]?.valueKg).toBe(80);
  });

  it('returns an empty series for no points', () => {
    expect(movingAverage([], 7)).toEqual([]);
  });

  it('defaults to a 7-day window', () => {
    const points = Array.from({ length: 10 }, (_, index) =>
      point(addDays('2026-03-01', index), 80),
    );

    expect(movingAverage(points)).toHaveLength(10);
  });
});

describe('changeFromBaseline', () => {
  it('is null when there is no baseline and no data', () => {
    expect(changeFromBaseline([], null)).toBeNull();
  });

  it('uses the profile baseline when one is set', () => {
    expect(changeFromBaseline(series(['2026-03-01', 82]), 80)).toBeCloseTo(2, 6);
  });

  it('falls back to the first point when no baseline is set', () => {
    expect(changeFromBaseline(series(['2026-03-01', 82], ['2026-03-05', 81]), null)).toBeCloseTo(
      -1,
      6,
    );
  });

  it('is zero when the last point equals the baseline', () => {
    expect(changeFromBaseline(series(['2026-03-01', 80]), 80)).toBeCloseTo(0, 6);
  });

  it('is null when a baseline is set but nothing has been measured', () => {
    expect(changeFromBaseline([], 80)).toBeNull();
  });
});

describe('weeklyAverages', () => {
  it('averages each ISO week and counts entries', () => {
    const weekly = weeklyAverages(
      series(
        ['2026-03-02', 80],
        ['2026-03-04', 82],
        ['2026-03-09', 79],
      ),
    );

    expect(weekly.map((w) => w.key)).toEqual(['2026-W10', '2026-W11']);
    expect(weekly[0]?.averageKg).toBeCloseTo(81, 6);
    expect(weekly[0]?.count).toBe(2);
    expect(weekly[1]?.averageKg).toBeCloseTo(79, 6);
  });

  it('keys weeks correctly across a year boundary', () => {
    const weekly = weeklyAverages(
      series(
        ['2025-12-29', 80],
        ['2026-01-05', 79],
      ),
    );

    // 2025-12-29 is a Monday; ISO week numbering gives that week as 2026-W01.
    expect(weekly.map((w) => w.key)).toEqual(['2026-W01', '2026-W02']);
    expect(weekly[1]?.averageKg).toBeCloseTo(79, 6);
  });

  it('returns an empty list for no points', () => {
    expect(weeklyAverages([])).toEqual([]);
  });
});

describe('monthlyAverages', () => {
  it('keys months as YYYY-MM', () => {
    const monthly = monthlyAverages(
      series(
        ['2026-01-05', 80],
        ['2026-01-20', 82],
        ['2026-02-02', 79],
      ),
    );

    expect(monthly.map((m) => m.key)).toEqual(['2026-01', '2026-02']);
    expect(monthly[0]?.averageKg).toBeCloseTo(81, 6);
    expect(monthly[0]?.count).toBe(2);
  });

  it('returns an empty list for no points', () => {
    expect(monthlyAverages([])).toEqual([]);
  });
});