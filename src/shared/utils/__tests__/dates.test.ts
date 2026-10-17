/** @jest-environment node */
import {
  addDays,
  combineLocalDateTime,
  diffCalendarDays,
  formatDisplayDate,
  getDayNumber,
  getIsoWeekday,
  isValidLocalDate,
  listDatesInRange,
  parseLocalDate,
  toLocalDate,
  todayLocal,
} from '../dates';
import { AppError } from '../../errors/AppError';

describe('LocalDate validation', () => {
  it('accepts real calendar dates', () => {
    expect(isValidLocalDate('2026-10-12')).toBe(true);
    expect(isValidLocalDate('2024-02-29')).toBe(true);
  });

  it('rejects impossible dates and bad formats', () => {
    expect(isValidLocalDate('2026-02-30')).toBe(false);
    expect(isValidLocalDate('2026-13-01')).toBe(false);
    expect(isValidLocalDate('2026-10-32')).toBe(false);
    expect(isValidLocalDate('2026-1-1')).toBe(false);
    expect(isValidLocalDate('')).toBe(false);
  });
});

describe('calendar arithmetic', () => {
  it('counts Day 1 as the start date itself', () => {
    expect(getDayNumber('2026-10-12', '2026-10-12')).toBe(1);
  });

  it('makes Day 30 the start plus 29 days', () => {
    expect(getDayNumber('2026-10-12', addDays('2026-10-12', 29))).toBe(30);
  });

  it('crosses month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
  });

  it('handles the leap day', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01');
    expect(addDays('2025-02-28', 1)).toBe('2025-03-01');
  });

  it('differs by whole calendar days regardless of clock time', () => {
    expect(diffCalendarDays('2026-03-01', '2026-03-31')).toBe(30);
    expect(diffCalendarDays('2026-03-31', '2026-03-01')).toBe(-30);
    expect(diffCalendarDays('2026-03-01', '2026-03-01')).toBe(0);
  });

  it('is DST-safe: a 23-hour local day still counts as one day', () => {
    // 2026-03-29 is the European DST switch; 2026-10-25 is the US one.
    expect(diffCalendarDays('2026-03-28', '2026-03-30')).toBe(2);
    expect(diffCalendarDays('2026-03-29', '2026-03-30')).toBe(1);
    expect(diffCalendarDays('2026-10-24', '2026-10-26')).toBe(2);
    expect(getDayNumber('2026-03-01', '2026-03-30')).toBe(30);
  });

  it('rejects invalid input instead of returning NaN', () => {
    expect(() => addDays('2026-02-30', 1)).toThrow(AppError);
    expect(() => diffCalendarDays('nope', '2026-01-01')).toThrow(AppError);
    expect(() => parseLocalDate('2026-02-30')).toThrow(AppError);
  });
});

describe('weekdays', () => {
  it('uses ISO numbering 1=Mon .. 7=Sun', () => {
    expect(getIsoWeekday('2026-10-12')).toBe(1); // Monday
    expect(getIsoWeekday('2026-10-18')).toBe(7); // Sunday
    expect(getIsoWeekday('2026-10-11')).toBe(7); // Sunday
  });
});

describe('listing and formatting', () => {
  it('lists an inclusive range and returns empty when reversed', () => {
    expect(listDatesInRange('2026-10-01', '2026-10-03')).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
    ]);
    expect(listDatesInRange('2026-10-03', '2026-10-01')).toEqual([]);
  });

  it('formats as "Mon 12 Oct 2026"', () => {
    expect(formatDisplayDate('2026-10-12')).toBe('Mon 12 Oct 2026');
  });

  it('converts a Date to the local calendar day using local getters', () => {
    expect(toLocalDate(new Date(2026, 9, 12, 23, 30))).toBe('2026-10-12');
    expect(toLocalDate(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01');
  });

  it('uses the supplied instant for todayLocal', () => {
    expect(todayLocal(new Date(2026, 4, 5, 12, 0))).toBe('2026-05-05');
  });

  it('combines a local date and a local time', () => {
    const d = combineLocalDateTime('2026-10-12', '07:30');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(9);
    expect(d.getDate()).toBe(12);
    expect(d.getHours()).toBe(7);
    expect(d.getMinutes()).toBe(30);
    expect(() => combineLocalDateTime('2026-10-12', '25:00')).toThrow(AppError);
  });
});