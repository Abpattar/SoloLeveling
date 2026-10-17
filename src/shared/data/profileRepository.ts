/**
 * INTEGRATION CONTRACT: API-SET-001, API-SET-002, API-SET-003, API-SET-004
 * Purpose: the single `profile` row (id = 1), created lazily on first read.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (SET area), DATA_MODEL_AND_STORAGE §3
 * Consumers: shell (A7), body/progress (A6), referenceWeight (A1)
 * Contract status: APPROVED
 */
import { getDb } from '../db/database';
import { AppError } from '../errors/AppError';
import { nowIso } from '../utils/dates';
import type { Id } from '../types/common';
import type { Profile, ProfileUpdate, UnitSystem } from '../types/profile';

interface ProfileRow {
  height_cm: number | null;
  unit_system: string;
  baseline_weight_kg: number | null;
  onboarding_completed: number;
  disclaimer_acknowledged_at: string | null;
  created_at: string;
  updated_at: string;
}

const UNIT_SYSTEMS: UnitSystem[] = ['metric', 'imperial'];

function toProfile(row: ProfileRow): Profile {
  return {
    heightCm: row.height_cm === null ? null : Number(row.height_cm),
    unitSystem: UNIT_SYSTEMS.includes(row.unit_system as UnitSystem)
      ? (row.unit_system as UnitSystem)
      : 'metric',
    baselineWeightKg:
      row.baseline_weight_kg === null ? null : Number(row.baseline_weight_kg),
    onboardingCompleted: row.onboarding_completed === 1,
    disclaimerAcknowledgedAt: row.disclaimer_acknowledged_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertHeight(heightCm: number | null | undefined): void {
  if (heightCm === undefined || heightCm === null) {
    return;
  }
  if (!Number.isFinite(heightCm) || heightCm < 50 || heightCm > 260) {
    throw new AppError('VALIDATION', 'Height must be between 50 cm and 260 cm.');
  }
}

function assertWeight(weightKg: number | null | undefined): void {
  if (weightKg === undefined || weightKg === null) {
    return;
  }
  if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 400) {
    throw new AppError('VALIDATION', 'Weight must be between 20 kg and 400 kg.');
  }
}

/** API-SET-001 */
export async function getProfile(): Promise<Profile> {
  const db = await getDb();
  const existing = await db.queryOne<ProfileRow>('SELECT * FROM profile WHERE id = 1');
  if (existing) {
    return toProfile(existing);
  }
  const ts = nowIso();
  await db.execute(
    `INSERT INTO profile (id, height_cm, unit_system, baseline_weight_kg, onboarding_completed,
       disclaimer_acknowledged_at, created_at, updated_at)
     VALUES (1, NULL, 'metric', NULL, 0, NULL, ?, ?)`,
    [ts, ts],
  );
  const created = await db.queryOne<ProfileRow>('SELECT * FROM profile WHERE id = 1');
  if (!created) {
    throw new AppError('STORAGE', 'Your profile could not be loaded.');
  }
  return toProfile(created);
}

/** API-SET-002 */
export async function updateProfile(update: ProfileUpdate): Promise<Profile> {
  assertHeight(update.heightCm);
  assertWeight(update.baselineWeightKg);
  if (update.unitSystem !== undefined && !UNIT_SYSTEMS.includes(update.unitSystem)) {
    throw new AppError('VALIDATION', 'Choose either metric or imperial units.');
  }
  const current = await getProfile();
  const db = await getDb();
  await db.execute(
    `UPDATE profile
        SET height_cm = ?, unit_system = ?, baseline_weight_kg = ?, updated_at = ?
      WHERE id = 1`,
    [
      update.heightCm === undefined ? current.heightCm : update.heightCm,
      update.unitSystem ?? current.unitSystem,
      update.baselineWeightKg === undefined ? current.baselineWeightKg : update.baselineWeightKg,
      nowIso(),
    ],
  );
  return getProfile();
}

/** API-SET-004 */
export async function acknowledgeDisclaimer(): Promise<Profile> {
  const ts = nowIso();
  const current = await getProfile();
  const db = await getDb();
  await db.execute('UPDATE profile SET disclaimer_acknowledged_at = ?, updated_at = ? WHERE id = 1', [
    current.disclaimerAcknowledgedAt ?? ts,
    ts,
  ]);
  return getProfile();
}

/** API-SET-003 */
export async function completeOnboarding(): Promise<Profile> {
  const ts = nowIso();
  await getProfile();
  const db = await getDb();
  await db.execute('UPDATE profile SET onboarding_completed = 1, updated_at = ? WHERE id = 1', [ts]);
  return getProfile();
}

/** LOCAL-WORKAROUND (internal, this file): used by backup to replace the profile row verbatim. */
export async function replaceProfileFields(fields: {
  id?: Id;
  heightCm: number | null;
  unitSystem: string;
  baselineWeightKg: number | null;
  onboardingCompleted: boolean;
  disclaimerAcknowledgedAt: string | null;
  createdAt: string;
  updatedAt: string;
}): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE profile
        SET height_cm = ?, unit_system = ?, baseline_weight_kg = ?, onboarding_completed = ?,
            disclaimer_acknowledged_at = ?, created_at = ?, updated_at = ?
      WHERE id = 1`,
    [
      fields.heightCm,
      fields.unitSystem,
      fields.baselineWeightKg,
      fields.onboardingCompleted ? 1 : 0,
      fields.disclaimerAcknowledgedAt,
      fields.createdAt,
      fields.updatedAt,
    ],
  );
}