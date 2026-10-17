/**
 * INTEGRATION CONTRACT: TYPE-BODY-001 .. TYPE-BODY-004
 * Purpose: weight, waist, thigh and user-defined measurements.
 * Canonical definition: SHARED_CONTRACT.md §3.9
 * Consumers: body (A6), progress (A6), referenceWeight (A1)
 * Contract status: APPROVED
 */
import type { Id, IsoDateTime, LocalDate } from './common';

export type MeasurementType = 'weight' | 'waist' | 'thigh' | 'custom';

export interface Measurement {
  id: Id;
  type: MeasurementType;
  customLabel: string | null;
  value: number;
  unit: string; // 'kg'|'lb'|'cm'|'in'|custom text
  measuredAt: IsoDateTime;
  localDate: LocalDate;
  note: string | null;
  createdAt: IsoDateTime;
}

export interface MeasurementInput {
  type: MeasurementType;
  customLabel?: string | null;
  value: number;
  unit: string;
  measuredAt?: IsoDateTime;
  note?: string | null;
}

export interface WeightPoint {
  localDate: LocalDate;
  valueKg: number;
}