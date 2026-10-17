/**
 * INTEGRATION CONTRACT: API-UNIT-001 .. API-UNIT-008
 * Purpose: unit conversion and display formatting. Storage stays "as entered with an explicit unit"
 *          or canonical metric (`heightCm`, `baselineWeightKg`); conversion happens only here.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (UNIT area)
 * Consumers: body (A6), progress (A6), training (A2), shell (A7)
 * Contract status: APPROVED
 */
import type { UnitSystem } from '../types/profile';

const LB_PER_KG = 2.2046226218;
const CM_PER_INCH = 2.54;

/** API-UNIT-001 */
export function kgToLb(kg: number): number {
  return kg * LB_PER_KG;
}

/** API-UNIT-002 */
export function lbToKg(lb: number): number {
  return lb / LB_PER_KG;
}

/** API-UNIT-003 */
export function cmToIn(cm: number): number {
  return cm / CM_PER_INCH;
}

/** API-UNIT-004 */
export function inToCm(inches: number): number {
  return inches * CM_PER_INCH;
}

/** API-UNIT-005 — 'kg' | 'lb' (case-insensitive, trimmed); anything else is unknown, so null. */
export function toKg(value: number, unit: string): number | null {
  const normalized = unit.trim().toLowerCase();
  if (normalized === 'kg') {
    return value;
  }
  if (normalized === 'lb') {
    return lbToKg(value);
  }
  return null;
}

/** API-UNIT-006 — e.g. "72.5 kg" / "159.8 lb". */
export function formatWeight(kg: number, units: UnitSystem): string {
  if (units === 'imperial') {
    return `${kgToLb(kg).toFixed(1)} lb`;
  }
  return `${kg.toFixed(1)} kg`;
}

/** API-UNIT-007 — metric "170 cm", imperial "5 ft 7 in". */
export function formatLength(cm: number, units: UnitSystem): string {
  if (units === 'metric') {
    return `${Math.round(cm)} cm`;
  }
  const totalInches = cmToIn(cm);
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches - feet * 12);
  return `${feet} ft ${inches} in`;
}

/** API-UNIT-008 */
export function weightUnitLabel(units: UnitSystem): 'kg' | 'lb' {
  return units === 'imperial' ? 'lb' : 'kg';
}