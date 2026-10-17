/**
 * INTEGRATION CONTRACT: TYPE-CORE-001 .. TYPE-CORE-007
 * Purpose: canonical primitive types used by every module.
 * Canonical definition: SHARED_CONTRACT.md §3.1 (verbatim)
 * Consumers: every module
 * Contract status: APPROVED
 */
import type { AppError } from '../errors/AppError';

export type Id = string;
export type IsoDateTime = string; // UTC instant, e.g. "2026-10-12T04:30:00.000Z"
export type LocalDate = string; // device-local day "YYYY-MM-DD"
export type LocalTime = string; // device-local "HH:mm" (24h)
export type Unsubscribe = () => void;
export type Result<T> = { ok: true; value: T } | { ok: false; error: AppError };
export type DeepPartial<T> = T extends (infer U)[]
  ? U[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;