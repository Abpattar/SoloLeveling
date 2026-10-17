/**
 * INTEGRATION CONTRACT: API-JRN-001 .. API-JRN-006
 * Purpose: the optional recovery journal. Tracking only: it records what the user felt and never
 *          interprets it. At least one field must be set, otherwise there is nothing to record.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (JRN area), ERROR_HANDLING_AND_SECURITY SAF-03
 * Consumers: journal screens (A6), progress dailySummary (A6)
 * Contract status: APPROVED
 */
import { getDb } from '@/shared/db/database';
import { AppError } from '@/shared/errors/AppError';
import { isValidLocalDate, nowIso, todayLocal } from '@/shared/utils/dates';
import { newId } from '@/shared/utils/ids';
import type { Id, LocalDate } from '@/shared/types/common';
import type { JournalEntry, JournalEntryInput, SwellingLevel } from '@/shared/types/journal';
import type { SymptomFlag } from '@/shared/types/safety';

interface JournalRow {
  id: string;
  local_date: string;
  recorded_at: string;
  pain_score: number | null;
  stiffness_score: number | null;
  swelling_level: string | null;
  symptom_flags: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const SWELLING: SwellingLevel[] = ['none', 'mild', 'moderate', 'significant'];

function parseFlags(raw: string): SymptomFlag[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SymptomFlag[]) : [];
  } catch {
    return [];
  }
}

function toEntry(row: JournalRow): JournalEntry {
  return {
    id: row.id,
    localDate: row.local_date,
    recordedAt: row.recorded_at,
    painScore: row.pain_score === null ? null : Number(row.pain_score),
    stiffnessScore: row.stiffness_score === null ? null : Number(row.stiffness_score),
    swellingLevel: row.swelling_level as SwellingLevel | null,
    symptomFlags: parseFlags(row.symptom_flags),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function score(value: number | null | undefined, label: string): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!Number.isInteger(value) || value < 0 || value > 10) {
    throw new AppError('VALIDATION', `${label} must be a whole number from 0 to 10.`);
  }
  return value;
}

function normalizeNotes(notes: string | null | undefined): string | null {
  if (notes === undefined || notes === null) {
    return null;
  }
  if (typeof notes !== 'string') {
    throw new AppError('VALIDATION', 'The note must be text.');
  }
  if (notes.length > 4000) {
    throw new AppError('VALIDATION', 'Notes must be 4000 characters or fewer.');
  }
  const trimmed = notes.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDate(date: LocalDate | undefined): LocalDate {
  const value = date ?? todayLocal();
  if (!isValidLocalDate(value)) {
    throw new AppError('VALIDATION', 'That date is not valid.');
  }
  if (value > todayLocal()) {
    throw new AppError('VALIDATION', 'A journal entry cannot be from the future.');
  }
  return value;
}

function assertSomethingRecorded(input: {
  painScore: number | null;
  stiffnessScore: number | null;
  swellingLevel: SwellingLevel | null;
  symptomFlags: SymptomFlag[];
  notes: string | null;
}): void {
  if (
    input.painScore === null &&
    input.stiffnessScore === null &&
    input.swellingLevel === null &&
    input.symptomFlags.length === 0 &&
    input.notes === null
  ) {
    throw new AppError('VALIDATION', 'Fill in at least one thing before saving.');
  }
}

async function loadById(id: Id): Promise<JournalEntry> {
  const db = await getDb();
  const row = await db.queryOne<JournalRow>('SELECT * FROM journal_entries WHERE id = ?', [id]);
  if (!row) {
    throw new AppError('NOT_FOUND', 'That journal entry is no longer in your list.');
  }
  return toEntry(row);
}

/** API-JRN-001 */
export async function createJournalEntry(input: JournalEntryInput): Promise<JournalEntry> {
  const localDate = normalizeDate(input.localDate);
  const painScore = score(input.painScore, 'Pain');
  const stiffnessScore = score(input.stiffnessScore, 'Stiffness');
  const swellingLevel = input.swellingLevel ?? null;
  if (swellingLevel !== null && !SWELLING.includes(swellingLevel)) {
    throw new AppError('VALIDATION', 'Choose a swelling level.');
  }
  const symptomFlags = input.symptomFlags ?? [];
  if (!Array.isArray(symptomFlags)) {
    throw new AppError('VALIDATION', 'Symptoms must be a list.');
  }
  const notes = normalizeNotes(input.notes);

  assertSomethingRecorded({ painScore, stiffnessScore, swellingLevel, symptomFlags, notes });

  const db = await getDb();
  const id = newId();
  const ts = nowIso();
  await db.execute(
    `INSERT INTO journal_entries (id, local_date, recorded_at, pain_score, stiffness_score,
        swelling_level, symptom_flags, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      localDate,
      ts,
      painScore,
      stiffnessScore,
      swellingLevel,
      JSON.stringify(symptomFlags),
      notes,
      ts,
      ts,
    ],
  );
  return loadById(id);
}

/** API-JRN-002 */
export async function updateJournalEntry(
  id: Id,
  patch: JournalEntryInput,
): Promise<JournalEntry> {
  const current = await loadById(id);
  const localDate = patch.localDate === undefined ? current.localDate : normalizeDate(patch.localDate);
  const painScore = score(
    patch.painScore === undefined ? current.painScore : patch.painScore,
    'Pain',
  );
  const stiffnessScore = score(
    patch.stiffnessScore === undefined ? current.stiffnessScore : patch.stiffnessScore,
    'Stiffness',
  );
  const swellingLevel =
    patch.swellingLevel === undefined ? current.swellingLevel : patch.swellingLevel;
  if (swellingLevel !== null && !SWELLING.includes(swellingLevel)) {
    throw new AppError('VALIDATION', 'Choose a swelling level.');
  }
  const symptomFlags = patch.symptomFlags === undefined ? current.symptomFlags : patch.symptomFlags;
  if (!Array.isArray(symptomFlags)) {
    throw new AppError('VALIDATION', 'Symptoms must be a list.');
  }
  const notes = normalizeNotes(patch.notes === undefined ? current.notes : patch.notes);

  assertSomethingRecorded({ painScore, stiffnessScore, swellingLevel, symptomFlags, notes });

  const db = await getDb();
  await db.execute(
    `UPDATE journal_entries
        SET local_date = ?, pain_score = ?, stiffness_score = ?, swelling_level = ?,
            symptom_flags = ?, notes = ?, updated_at = ?
      WHERE id = ?`,
    [
      localDate,
      painScore,
      stiffnessScore,
      swellingLevel,
      JSON.stringify(symptomFlags),
      notes,
      nowIso(),
      id,
    ],
  );
  return loadById(id);
}

/** API-JRN-003 */
export async function deleteJournalEntry(id: Id): Promise<void> {
  const db = await getDb();
  const result = await db.execute('DELETE FROM journal_entries WHERE id = ?', [id]);
  if (result.changes === 0) {
    throw new AppError('NOT_FOUND', 'That journal entry is no longer in your list.');
  }
}

/** API-JRN-004 — newest first. */
export async function listJournalEntries(opts?: {
  from?: LocalDate;
  to?: LocalDate;
  limit?: number;
}): Promise<JournalEntry[]> {
  if ((opts?.from && !isValidLocalDate(opts.from)) || (opts?.to && !isValidLocalDate(opts.to))) {
    throw new AppError('VALIDATION', 'That date is not valid.');
  }
  const clauses: string[] = [];
  const params: Array<string | number | null> = [];
  if (opts?.from) {
    clauses.push('local_date >= ?');
    params.push(opts.from);
  }
  if (opts?.to) {
    clauses.push('local_date <= ?');
    params.push(opts.to);
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const limit =
    opts?.limit !== undefined && Number.isInteger(opts.limit) && opts.limit > 0
      ? ` LIMIT ${Math.min(opts.limit, 500)}`
      : '';
  const db = await getDb();
  const rows = await db.query<JournalRow>(
    `SELECT * FROM journal_entries ${where} ORDER BY local_date DESC, recorded_at DESC${limit}`,
    params,
  );
  return rows.map(toEntry);
}

/** API-JRN-005 */
export async function getJournalEntriesForDate(date: LocalDate): Promise<JournalEntry[]> {
  return listJournalEntries({ from: date, to: date });
}

/** API-JRN-006 */
export async function getJournalEntry(id: Id): Promise<JournalEntry> {
  return loadById(id);
}