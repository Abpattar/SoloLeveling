/**
 * INTEGRATION CONTRACT: API-CORE-003, API-CORE-004
 * Purpose: helpers for I/O services, which return `Result<T>` and never throw for expected failures.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (API-CORE-003, API-CORE-004)
 * Consumers: nutrition-ai (A4), backup (A4), food (A3), photos (A5)
 * Contract status: APPROVED
 */
import { AppError } from './AppError';
import type { AppErrorCode } from './AppError';
import type { Result } from '../types/common';

/** API-CORE-003 */
export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

/** API-CORE-004 */
export function fail(error: AppError | AppErrorCode, message?: string): Result<never> {
  if (error instanceof AppError) {
    return { ok: false, error };
  }
  return {
    ok: false,
    error: new AppError(error, message ?? 'Something went wrong.'),
  };
}