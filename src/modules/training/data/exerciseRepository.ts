/**
 * INTEGRATION CONTRACT: API-TRN-001 .. API-TRN-007
 * Purpose: CRUD for the user's OWN exercise list. There is no built-in library and nothing here ever
 *          changes an exercise on its own (SAF-02, GAT-005). Every mutation emits `exercises.changed`.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (TRN area), DATA_MODEL_AND_STORAGE §2 `exercises`
 * Consumers: training screens (A2), reminders (A2), progress (A6), Today card (A7 via A2)
 * Contract status: APPROVED
 */
import { getDb } from '@/shared/db/database';
import { AppError } from '@/shared/errors/AppError';
import { appEvents } from '@/shared/events/appEvents';
import { getIsoWeekday, isValidLocalDate, nowIso } from '@/shared/utils/dates';
import { newId } from '@/shared/utils/ids';
import { validateExerciseInput, validateExercisePatch } from '../domain/validation';
import type { NormalizedExerciseInput } from '../domain/validation';
import type { Id, LocalDate } from '@/shared/types/common';
import type { Exercise, ExerciseInput, Weekday } from '@/shared/types/training';

interface ExerciseRow {
  id: string;
  name: string;
  instructions: string | null;
  sets: number;
  reps: number | null;
  duration_seconds: number | null;
  rest_seconds: number;
  schedule_days: string;
  clinician_notes: string | null;
  intensity: string | null;
  status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** LOCAL-WORKAROUND (internal, this file): a malformed JSON column degrades to an empty schedule. */
function parseScheduleDays(raw: string): Weekday[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (d): d is Weekday => typeof d === 'number' && Number.isInteger(d) && d >= 1 && d <= 7,
    );
  } catch {
    return [];
  }
}

function toExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    name: row.name,
    instructions: row.instructions,
    sets: Number(row.sets),
    reps: row.reps === null ? null : Number(row.reps),
    durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
    restSeconds: Number(row.rest_seconds),
    scheduleDays: parseScheduleDays(row.schedule_days),
    clinicianNotes: row.clinician_notes,
    intensity: row.intensity as Exercise['intensity'],
    status: row.status as Exercise['status'],
    sortOrder: Number(row.sort_order),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function fetchById(id: Id): Promise<Exercise> {
  const db = await getDb();
  const row = await db.queryOne<ExerciseRow>('SELECT * FROM exercises WHERE id = ?', [id]);
  if (!row) {
    throw new AppError('NOT_FOUND', 'That exercise is no longer in your list.');
  }
  return toExercise(row);
}

/** API-TRN-001 */
export async function listExercises(opts?: { includePaused?: boolean }): Promise<Exercise[]> {
  const db = await getDb();
  const rows = opts?.includePaused
    ? await db.query<ExerciseRow>('SELECT * FROM exercises ORDER BY sort_order ASC, name ASC')
    : await db.query<ExerciseRow>(
        "SELECT * FROM exercises WHERE status = 'active' ORDER BY sort_order ASC, name ASC",
      );
  return rows.map(toExercise);
}

/** API-TRN-002 */
export async function getExercise(id: Id): Promise<Exercise> {
  return fetchById(id);
}

/** API-TRN-003 */
export async function createExercise(input: ExerciseInput): Promise<Exercise> {
  const value = validateExerciseInput(input);
  const db = await getDb();
  const id = newId();
  const ts = nowIso();
  const nextOrder = await db.queryOne<{ next: number }>(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM exercises',
  );
  await db.execute(
    `INSERT INTO exercises (id, name, instructions, sets, reps, duration_seconds, rest_seconds,
        schedule_days, clinician_notes, intensity, status, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      value.name,
      value.instructions,
      value.sets,
      value.reps,
      value.durationSeconds,
      value.restSeconds,
      JSON.stringify(value.scheduleDays),
      value.clinicianNotes,
      value.intensity,
      value.status,
      Number(nextOrder?.next ?? 0),
      ts,
      ts,
    ],
  );
  appEvents.emit('exercises.changed', {});
  return fetchById(id);
}

/** API-TRN-004 */
export async function updateExercise(id: Id, patch: Partial<ExerciseInput>): Promise<Exercise> {
  const current = toExerciseInput(await fetchById(id));
  const value = validateExercisePatch(patch, current as NormalizedExerciseInput);
  const db = await getDb();
  await db.execute(
    `UPDATE exercises
        SET name = ?, instructions = ?, sets = ?, reps = ?, duration_seconds = ?, rest_seconds = ?,
            schedule_days = ?, clinician_notes = ?, intensity = ?, status = ?, updated_at = ?
      WHERE id = ?`,
    [
      value.name,
      value.instructions,
      value.sets,
      value.reps,
      value.durationSeconds,
      value.restSeconds,
      JSON.stringify(value.scheduleDays),
      value.clinicianNotes,
      value.intensity,
      value.status,
      nowIso(),
      id,
    ],
  );
  appEvents.emit('exercises.changed', {});
  return fetchById(id);
}

function toExerciseInput(exercise: Exercise): ExerciseInput {
  return {
    name: exercise.name,
    instructions: exercise.instructions,
    sets: exercise.sets,
    reps: exercise.reps,
    durationSeconds: exercise.durationSeconds,
    restSeconds: exercise.restSeconds,
    scheduleDays: exercise.scheduleDays,
    clinicianNotes: exercise.clinicianNotes,
    intensity: exercise.intensity,
    status: exercise.status,
  };
}

/** API-TRN-005 — history keeps its name snapshot; the FK goes NULL instead of cascading. */
export async function deleteExercise(id: Id): Promise<void> {
  const db = await getDb();
  const result = await db.execute('DELETE FROM exercises WHERE id = ?', [id]);
  if (result.changes === 0) {
    throw new AppError('NOT_FOUND', 'That exercise is no longer in your list.');
  }
  appEvents.emit('exercises.changed', {});
}

/** API-TRN-006 — the caller must list every existing id exactly once. */
export async function reorderExercises(orderedIds: Id[]): Promise<void> {
  const db = await getDb();
  const rows = await db.query<{ id: string }>('SELECT id FROM exercises');
  const existing = new Set(rows.map((r) => r.id));
  const seen = new Set<string>();
  for (const id of orderedIds) {
    if (!existing.has(id)) {
      throw new AppError('VALIDATION', 'That exercise list could not be reordered.');
    }
    if (seen.has(id)) {
      throw new AppError('VALIDATION', 'That exercise list could not be reordered.');
    }
    seen.add(id);
  }
  if (seen.size !== existing.size) {
    throw new AppError('VALIDATION', 'That exercise list could not be reordered.');
  }

  await db.transaction(async (tx) => {
    for (let index = 0; index < orderedIds.length; index += 1) {
      await tx.execute('UPDATE exercises SET sort_order = ?, updated_at = ? WHERE id = ?', [
        index,
        nowIso(),
        orderedIds[index],
      ]);
    }
  });
  appEvents.emit('exercises.changed', {});
}

/** API-TRN-007 */
export async function listExercisesScheduledFor(date: LocalDate): Promise<Exercise[]> {
  if (!isValidLocalDate(date)) {
    throw new AppError('VALIDATION', 'That date is not valid.');
  }
  const weekday = getIsoWeekday(date);
  const all = await listExercises();
  return all.filter((exercise) => exercise.scheduleDays.includes(weekday));
}