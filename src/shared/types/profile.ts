/**
 * INTEGRATION CONTRACT: TYPE-SET-001, TYPE-SET-002, TYPE-SET-003
 * Purpose: the single user profile row (height, units, baseline weight, onboarding state).
 * Canonical definition: SHARED_CONTRACT.md §3.3
 * Consumers: shell (A7), body/progress (A6), activityCalories (A1)
 * Contract status: APPROVED
 */
import type { IsoDateTime } from './common';

export type UnitSystem = 'metric' | 'imperial';

export interface Profile {
  heightCm: number | null;
  unitSystem: UnitSystem;
  baselineWeightKg: number | null;
  onboardingCompleted: boolean;
  disclaimerAcknowledgedAt: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface ProfileUpdate {
  heightCm?: number | null;
  unitSystem?: UnitSystem;
  baselineWeightKg?: number | null;
}