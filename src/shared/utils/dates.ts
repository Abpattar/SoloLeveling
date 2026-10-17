/**
 * INTEGRATION CONTRACT: API-CORE-006, API-DATE-001 .. API-DATE-011
 * Purpose: the only date/time helpers in the app. All calendar math is DST-safe integer Y-M-D
 *          arithmetic via Date.UTC; never subtract local `Date` objects or 86_400_000 ms.
 * Canonical definition: SHARED_CONTRACT.md §2.1, SHARED_SYMBOL_REGISTRY.md (DATE area)
 * Consumers: every module
 * Contract status: APPROVED
 */
import { AppError } from '../errors/AppError';
import type { IsoDateTime, LocalDate, LocalTime } from '../types/common';
import type { Weekday } from '../types/training';

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** API-CORE-006 */
export function nowIso(): IsoDateTime {
  return new Date().toISOString();
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** API-DATE-008 */
export function isValidLocalDate(s: string): s is LocalDate {
  if (!LOCAL_DATE_PATTERN.test(s)) {
    return false;
  }
  const [year, month, day] = s.split('-').map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return false;
  }
  // Rejects impossible calendar dates such as 2026-02-30 and 2026-13-01.
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day
  );
}

export function isValidLocalTime(s: string): s is LocalTime {
  return LOCAL_TIME_PATTERN.test(s);
}

/** API-DATE-001 */
export function toLocalDate(d: Date): LocalDate {
  const year = d.getFullYear();
  const month = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${year}-${month}-${day}`;
}

/** API-DATE-002 */
export function todayLocal(now?: Date): LocalDate {
  return toLocalDate(now ?? new Date());
}

/** API-DATE-003 */
export function parseLocalDate(s: LocalDate): Date {
  if (!isValidLocalDate(s)) {
    throw new AppError('VALIDATION', 'That date is not valid.');
  }
  const [year, month, day] = s.split('-').map((part) => Number.parseInt(part, 10));
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function toUtcMillis(date: LocalDate): number {
  const [year, month, day] = date.split('-').map((part) => Number.parseInt(part, 10));
  return Date.UTC(year, month - 1, day);
}

function fromUtcMillis(ms: number): LocalDate {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** API-DATE-004 */
export function addDays(date: LocalDate, n: number): LocalDate {
  if (!isValidLocalDate(date)) {
    throw new AppError('VALIDATION', 'That date is not valid.');
  }
  if (!Number.isFinite(n)) {
    throw new AppError('VALIDATION', 'That number of days is not valid.');
  }
  return fromUtcMillis(toUtcMillis(date) + Math.trunc(n) * 86_400_000);
}

/** API-DATE-005 */
export function diffCalendarDays(from: LocalDate, to: LocalDate): number {
  if (!isValidLocalDate(from) || !isValidLocalDate(to)) {
    throw new AppError('VALIDATION', 'That date is not valid.');
  }
  return Math.round((toUtcMillis(to) - toUtcMillis(from)) / 86_400_000);
}

/** API-DATE-006 — "Day N" = diffCalendarDays(startDate, date) + 1, so Day 30 = start + 29 days. */
/**
 * LOCAL-WORKAROUND (A6): the ISO week key used by the weight and progress trend maths, e.g.
 * "2026-W01". ISO weeks belong to the year of that week's Thursday, which is why a date in late
 * December can be week 1 of the next year. Local-only date maths on `Date.UTC`, like the rest of
 * this file.
 */
export function isoWeekKey(date: LocalDate): string {
  const [year, month, day] = date.split('-').map((part) => Number.parseInt(part, 10));
  const utc = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = (utc.getUTCDay() + 6) % 7; // 0 = Monday
  const thursday = new Date(utc.getTime() + (3 - dayOfWeek) * 86_400_000);
  const thursdayYear = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(thursdayYear, 0, 4));
  const jan4DayOfWeek = (jan4.getUTCDay() + 6) % 7;
  const week1Monday = new Date(jan4.getTime() - jan4DayOfWeek * 86_400_000);
  const week = Math.round((thursday.getTime() - week1Monday.getTime()) / (7 * 86_400_000)) + 1;
  return `${thursdayYear}-W${String(week).padStart(2, '0')}`;
}

export function getDayNumber(startDate: LocalDate, onDate: LocalDate): number {
  return diffCalendarDays(startDate, onDate) + 1;
}

/** API-DATE-007 — ISO weekday, 1 = Monday … 7 = Sunday. */
export function getIsoWeekday(date: LocalDate): Weekday {
  const jsDay = new Date(toUtcMillis(date)).getUTCDay(); // 0 = Sunday
  return (jsDay === 0 ? 7 : jsDay) as Weekday;
}

/** API-DATE-009 */
export function listDatesInRange(from: LocalDate, to: LocalDate): LocalDate[] {
  const total = diffCalendarDays(from, to);
  const out: LocalDate[] = [];
  for (let i = 0; i <= total; i += 1) {
    out.push(addDays(from, i));
  }
  return out;
}

/** API-DATE-010 */
export function combineLocalDateTime(date: LocalDate, time: LocalTime): Date {
  if (!isValidLocalDate(date)) {
    throw new AppError('VALIDATION', 'That date is not valid.');
  }
  if (!isValidLocalTime(time)) {
    throw new AppError('VALIDATION', 'That time is not valid.');
  }
  const [year, month, day] = date.split('-').map((part) => Number.parseInt(part, 10));
  const [hours, minutes] = time.split(':').map((part) => Number.parseInt(part, 10));
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

/** API-DATE-011 — e.g. "Mon 12 Oct 2026". No Intl dependency. */
export function formatDisplayDate(date: LocalDate): string {
  if (!isValidLocalDate(date)) {
    return date;
  }
  const [year, month, day] = date.split('-').map((part) => Number.parseInt(part, 10));
  const weekdayName = WEEKDAY_NAMES[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${weekdayName} ${day} ${MONTH_NAMES[month - 1]} ${year}`;
}

/**
 * LOCAL-WORKAROUND (internal helper, A1-owned file, not a registry symbol).
 * Converts a UTC instant into the device-local calendar day it belongs to. Used when a caller
 * supplies an `IsoDateTime` but no `LocalDate` (e.g. saving a session or a food entry).
 */
export function localDateFromInstant(instant: IsoDateTime): LocalDate {
  const d = new Date(instant);
  if (Number.isNaN(d.getTime())) {
    throw new AppError('VALIDATION', 'That timestamp is not valid.');
  }
  return toLocalDate(d);
}

/** Local helper (not a registry symbol): `Id`-keyed lookup used by settings merge. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

