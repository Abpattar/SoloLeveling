/** @jest-environment node */
import { AppError, isAppError, toAppError } from '../AppError';
import { fail, ok } from '../result';

describe('AppError', () => {
  it('keeps the code, cause and details', () => {
    const cause = new Error('root');
    const error = new AppError('STORAGE', 'Could not save.', { cause, details: { table: 'food_entries' } });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('AppError');
    expect(error.code).toBe('STORAGE');
    expect(error.message).toBe('Could not save.');
    expect(error.cause).toBe(cause);
    expect(error.details).toEqual({ table: 'food_entries' });
  });

  it('is recognisable with isAppError', () => {
    expect(isAppError(new AppError('NOT_FOUND', 'gone'))).toBe(true);
    expect(isAppError(new Error('plain'))).toBe(false);
    expect(isAppError('string')).toBe(false);
    expect(isAppError(null)).toBe(false);
  });
});

describe('toAppError', () => {
  it('returns an AppError unchanged', () => {
    const original = new AppError('LOCKED', 'locked');
    expect(toAppError(original)).toBe(original);
  });

  it('wraps a plain Error with the fallback code', () => {
    const wrapped = toAppError(new Error('boom'), 'STORAGE');
    expect(wrapped.code).toBe('STORAGE');
    expect(wrapped.message).toBe('boom');
  });

  it('defaults the code to UNKNOWN', () => {
    expect(toAppError(new Error('boom')).code).toBe('UNKNOWN');
    expect(toAppError('a string failure').message).toBe('a string failure');
    expect(toAppError(undefined).code).toBe('UNKNOWN');
  });
});

describe('Result helpers', () => {
  it('wraps a value with ok', () => {
    const result = ok(42);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(42);
    }
  });

  it('accepts a code or an AppError with fail', () => {
    const byCode = fail('RATE_LIMITED', 'Too many requests.');
    expect(byCode.ok).toBe(false);
    if (!byCode.ok) {
      expect(byCode.error.code).toBe('RATE_LIMITED');
      expect(byCode.error.message).toBe('Too many requests.');
    }

    const original = new AppError('OFFLINE', 'No connection.');
    const byError = fail(original);
    if (!byError.ok) {
      expect(byError.error).toBe(original);
    }
  });

  it('supplies a readable default message', () => {
    const result = fail('CANCELLED');
    if (!result.ok) {
      expect(result.error.message).toBe('Something went wrong.');
    }
  });
});