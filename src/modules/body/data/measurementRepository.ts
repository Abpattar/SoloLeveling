/**
 * INTEGRATION CONTRACT: API-BODY-001 .. API-BODY-005
 * Purpose: dated weight and other measurements, stored exactly as entered with an explicit unit.
 *          Conversion to kg happens only when a weight series is needed, never on the way in.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (BODY area)
 * Consumers: body screens (A6), progress (A6), dailySummary (A6), referenceWeight (A1)
 * Contract status: APPROVED
 */
import { getDb } from '@/shared/db/database';
import { AppError } from '@/shared/errors/AppError';
// CONTRACT: API-UNIT-005 (A1) — unit conversion, the only place it happens
import { toKg } from '@/shared/utils/units';
import { isValidLocalDate, localDateFromInstant, nowIso } from '@/shared/utils/dates';
import { newId } from '@/shared/utils/ids';
import type { Id, LocalDate } from '@/shared/types/common';
import type { Measurement, MeasurementInput, MeasurementType, WeightPoint } from '@/shared/types/body';

interface MeasurementRow {
  id: string;
  type: string;
  custom_label: string | null;
  value: number;
  unit: string;
  measured_at: string;
  local_date: string;
  note: string | null;
  created_at: string;
}

const TYPES: MeasurementType[] = ['weight', 'waist', 'thigh', 'custom'];

function toMeasurement(row: MeasurementRow): Measurement {
  return {
    id: row.id,
    type: row.type as MeasurementType,
    customLabel: row.custom_label,
    value: Number(row.value),
    unit: row.unit,
    measuredAt: row.measured_at,
    localDate: row.local_date,
    note: row.note,
    createdAt: row.created_at,
  };
}

function normalize(input: MeasurementInput): Required<
  Pick<MeasurementInput, 'type' | 'value' | 'unit'>
> & { customLabel: string | null; note: string | null; measuredAt: string } {
  if (!TYPES.includes(input.type)) {
    throw new AppError('VALIDATION', 'That measurement type is not valid.');
  }
  if (typeof input.value !== 'number' || !Number.isFinite(input.value) || input.value <= 0) {
    throw new AppError('VALIDATION', 'Enter a value greater than zero.');
  }
  if (typeof input.unit !== 'string' || input.unit.trim().length === 0) {
    throw new AppError('VALIDATION', 'Enter a unit, for example kg or cm.');
  }
  const unit = input.unit.trim();
  if (unit.length > 12) {
    throw new AppError('VALIDATION', 'That unit name is too long.');
  }

  if (input.type === 'weight') {
    const kg = toKg(input.value, unit);
    if (kg === null) {
      throw new AppError('VALIDATION', 'Weight must be entered in kg or lb.');
    }
    if (kg < 20 || kg > 400) {
      throw new AppError('VALIDATION', 'Weight must be between 20 kg and 400 kg.');
    }
  }

  let customLabel: string | null = null;
  if (input.type === 'custom') {
    const label = typeof input.customLabel === 'string' ? input.customLabel.trim() : '';
    if (label.length === 0) {
      throw new AppError('VALIDATION', 'Give this measurement a name.');
    }
    if (label.length > 40) {
      throw new AppError('VALIDATION', 'That measurement name must be 40 characters or fewer.');
    }
    customLabel = label;
  }

  let note: string | null = null;
  if (input.note !== null && input.note !== undefined) {
    if (typeof input.note !== 'string') {
      throw new AppError('VALIDATION', 'The note must be text.');
    }
    const trimmed = input.note.trim();
    if (trimmed.length > 500) {
      throw new AppError('VALIDATION', 'Notes must be 500 characters or fewer.');
    }
    note = trimmed.length > 0 ? trimmed : null;
  }

  const measuredAt = input.measuredAt ?? nowIso();
  const ms = Date.parse(measuredAt);
  if (Number.isNaN(ms)) {
    throw new AppError('VALIDATION', 'That time is not valid.');
  }
  if (ms > Date.now() + 60_000) {
    throw new AppError('VALIDATION', 'A measurement cannot be from the future.');
  }

  return { type: input.type, value: input.value, unit, customLabel, note, measuredAt };
}

async function loadById(id: Id): Promise<Measurement> {
  const db = await getDb();
  const row = await db.queryOne<MeasurementRow>('SELECT * FROM measurements WHERE id = ?', [id]);
  if (!row) {
    throw new AppError('NOT_FOUND', 'That measurement is no longer in your list.');
  }
  return toMeasurement(row);
}

/** API-BODY-001 */
export async function addMeasurement(input: MeasurementInput): Promise<Measurement> {
  const value = normalize(input);
  const db = await getDb();
  const id = newId();
  await db.execute(
    `INSERT INTO measurements (id, type, custom_label, value, unit, measured_at, local_date, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      value.type,
      value.customLabel,
      value.value,
      value.unit,
      value.measuredAt,
      localDateFromInstant(value.measuredAt),
      value.note,
      nowIso(),
    ],
  );
  return loadById(id);
}

/** API-BODY-002 */
export async function updateMeasurement(
  id: Id,
  patch: Partial<MeasurementInput>,
): Promise<Measurement> {
  const current = await loadById(id);
  const merged: MeasurementInput = {
    type: patch.type ?? current.type,
    customLabel: patch.customLabel === undefined ? current.customLabel : patch.customLabel,
    value: patch.value ?? current.value,
    unit: patch.unit ?? current.unit,
    measuredAt: patch.measuredAt ?? current.measuredAt,
    note: patch.note === undefined ? current.note : patch.note,
  };
  const value = normalize(merged);
  const db = await getDb();
  await db.execute(
    `UPDATE measurements
        SET type = ?, custom_label = ?, value = ?, unit = ?, measured_at = ?, local_date = ?, note = ?
      WHERE id = ?`,
    [
      value.type,
      value.customLabel,
      value.value,
      value.unit,
      value.measuredAt,
      localDateFromInstant(value.measuredAt),
      value.note,
      id,
    ],
  );
  return loadById(id);
}

/** API-BODY-003 */
export async function deleteMeasurement(id: Id): Promise<void> {
  const db = await getDb();
  const result = await db.execute('DELETE FROM measurements WHERE id = ?', [id]);
  if (result.changes === 0) {
    throw new AppError('NOT_FOUND', 'That measurement is no longer in your list.');
  }
}

/** API-BODY-004 — date ascending, newest last. */
export async function listMeasurements(opts?: {
  type?: MeasurementType;
  customLabel?: string;
  from?: LocalDate;
  to?: LocalDate;
}): Promise<Measurement[]> {
  if ((opts?.from && !isValidLocalDate(opts.from)) || (opts?.to && !isValidLocalDate(opts.to))) {
    throw new AppError('VALIDATION', 'That date is not valid.');
  }
  const clauses: string[] = [];
  const params: Array<string | number | null> = [];
  if (opts?.type) {
    clauses.push('type = ?');
    params.push(opts.type);
  }
  if (opts?.customLabel) {
    clauses.push('custom_label = ?');
    params.push(opts.customLabel);
  }
  if (opts?.from) {
    clauses.push('local_date >= ?');
    params.push(opts.from);
  }
  if (opts?.to) {
    clauses.push('local_date <= ?');
    params.push(opts.to);
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const db = await getDb();
  const rows = await db.query<MeasurementRow>(
    `SELECT * FROM measurements ${where} ORDER BY local_date ASC, measured_at ASC`,
    params,
  );
  return rows.map(toMeasurement);
}

/** API-BODY-005 — one point per date: the latest measurement of that day, converted to kg. */
export async function getWeightSeriesKg(opts?: {
  from?: LocalDate;
  to?: LocalDate;
}): Promise<WeightPoint[]> {
  const rows = await listMeasurements({ type: 'weight', from: opts?.from, to: opts?.to });
  const byDate = new Map<LocalDate, Measurement>();
  for (const row of rows) {
    const existing = byDate.get(row.localDate);
    if (!existing || Date.parse(row.measuredAt) >= Date.parse(existing.measuredAt)) {
      byDate.set(row.localDate, row);
    }
  }
  const points: WeightPoint[] = [];
  for (const [date, measurement] of byDate) {
    const kg = toKg(measurement.value, measurement.unit);
    if (kg !== null && Number.isFinite(kg) && kg > 0) {
      points.push({ localDate: date, valueKg: kg });
    }
  }
  return points.sort((a, b) => (a.localDate < b.localDate ? -1 : a.localDate > b.localDate ? 1 : 0));
}