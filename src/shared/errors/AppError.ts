/**
 * INTEGRATION CONTRACT: TYPE-CORE-008, CLS-CORE-001, API-CORE-001, API-CORE-002
 * Purpose: the only error type the app throws; repositories throw it, UI shows `error.message`.
 * Canonical definition: SHARED_CONTRACT.md §3.2
 * Consumers: every module
 * Contract status: APPROVED
 */

/** TYPE-CORE-008 */
export type AppErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'STORAGE'
  | 'PERMISSION_DENIED'
  | 'OFFLINE'
  | 'NETWORK'
  | 'CONSENT_REQUIRED'
  | 'NOT_CONFIGURED'
  | 'PROVIDER_ERROR'
  | 'RATE_LIMITED'
  | 'PARSE_ERROR'
  | 'UNSUPPORTED'
  | 'LOCKED'
  | 'CANCELLED'
  | 'UNKNOWN';

export interface AppErrorOptions {
  cause?: unknown;
  details?: Record<string, string | number | boolean | null>;
}

/** CLS-CORE-001 */
export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly cause?: unknown;
  readonly details?: Record<string, string | number | boolean | null>;

  constructor(code: AppErrorCode, message: string, options?: AppErrorOptions) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    if (options && 'cause' in options) {
      this.cause = options.cause;
    }
    if (options?.details) {
      this.details = options.details;
    }
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/** API-CORE-001 */
export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

/** API-CORE-002 */
export function toAppError(e: unknown, fallback: AppErrorCode = 'UNKNOWN'): AppError {
  if (isAppError(e)) {
    return e;
  }
  if (e instanceof Error) {
    return new AppError(fallback, e.message, { cause: e });
  }
  if (typeof e === 'string' && e.length > 0) {
    return new AppError(fallback, e);
  }
  return new AppError(fallback, 'Something went wrong.');
}