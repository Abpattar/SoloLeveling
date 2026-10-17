/**
 * INTEGRATION CONTRACT: API-TRN-008 .. API-TRN-015
 * Purpose: records finished workouts. `saveSession` writes the session and its per-exercise results
 *          in ONE transaction and emits `session.saved` only after the commit succeeds.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (TRN area), DATA_MODEL_AND_STORAGE §2 `sessions`
 * Consumers: training screens (A2), progress (A6), reminders (A2), Today card (A7 via A2)
 * Contract status: APPROVED
 */
import { getDb } from '@/shared/db/database';
import { AppError } from '@/shared/errors/AppError';
import { appEvents } from '@/shared/events/appEvents';
import { estimateSessionKcal } from '@/shared/domain/activityCalories';
import { getReferenceWeightKg } from '@/shared/data/referenceWeight';
import { isValidLocalDate, localDateFromInstant, nowIso } from '@/shared/utils/dates';
import { newId } from '@/shared/utils/ids';
import { listExercisesScheduledFor } from './exerciseRepository';
import type { Db } from '@/shared/db/types';
import type { Id, LocalDate } from '@/shared/types/common';
import type { SymptomFlag } from '@/shared/types/safety';
import type {
  SaveSessionInput,
  Session,
  SessionDayStatus,
  SessionExerciseResult,
  SessionExerciseStatus,
  SessionStatus,
} from '@/shared/types/training';

interface SessionRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  local_date: string;
  status: string;
  total_duration_seconds: number;
  effort_rating: number | null;
  notes: string | null;
  pain_score: number | null;
  symptom_flags: string;
  estimated_kcal: number | null;
  created_at: string;
}

interface ResultRow {
  id: string;
  session_id: string;
  exercise_id: string | null;
  exercise_name: string;
  planned_sets: number;
  planned_reps: number | null;
  planned_duration_seconds: number | null;
  completed_sets: number;
  completed_reps: number | null;
  active_seconds: number;
  status: string;
  intensity: string | null;
  sort_order: number;
}

const RESULT_STATUSES: SessionExerciseStatus[] = ['completed', 'partial', 'skipped'];
const SESSION_STATUSES: SessionStatus[] = ['completed', 'stopped'];

function parseSymptomFlags(raw: string): SymptomFlag[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SymptomFlag[]) : [];
  } catch {
    return [];
  }
}

function toResult(row: ResultRow): SessionExerciseResult {
  return {
    id: row.id,
    sessionId: row.session_id,
    exerciseId: row.exercise_id,
    exerciseName: row.exercise_name,
    plannedSets: Number(row.planned_sets),
    plannedReps: row.planned_reps === null ? null : Number(row.planned_reps),
    plannedDurationSeconds:
      row.planned_duration_seconds === null ? null : Number(row.planned_duration_seconds),
    completedSets: Number(row.completed_sets),
    completedReps: row.completed_reps === null ? null : Number(row.completed_reps),
    activeSeconds: Number(row.active_seconds),
    status: row.status as SessionExerciseStatus,
    intensity: row.intensity as SessionExerciseResult['intensity'],
    sortOrder: Number(row.sort_order),
  };
}

function toSession(row: SessionRow, results: SessionExerciseResult[]): Session {
  return {
    id: row.id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    localDate: row.local_date,
    status: row.status as SessionStatus,
    totalDurationSeconds: Number(row.total_duration_seconds),
    effortRating: row.effort_rating === null ? null : Number(row.effort_rating),
    notes: row.notes,
    painScore: row.pain_score === null ? null : Number(row.pain_score),
    symptomFlags: parseSymptomFlags(row.symptom_flags),
    estimatedKcal: row.estimated_kcal === null ? null : Number(row.estimated_kcal),
    results: results.sort((a, b) => a.sortOrder - b.sortOrder),
    createdAt: row.created_at,
  };
}

async function loadResults(db: Db, sessionId: Id): Promise<SessionExerciseResult[]> {
  const rows = await db.query<ResultRow>(
    'SELECT * FROM session_exercise_results WHERE session_id = ? ORDER BY sort_order ASC',
    [sessionId],
  );
  return rows.map(toResult);
}

/** API-TRN-008 */
export async function saveSession(input: SaveSessionInput): Promise<Session> {
  if (input.results.length === 0) {
    throw new AppError('VALIDATION', 'A session needs at least one exercise result.');
  }
  const startedMs = Date.parse(input.startedAt);
  const endedMs = Date.parse(input.endedAt);
  if (Number.isNaN(startedMs) || Number.isNaN(endedMs)) {
    throw new AppError('VALIDATION', 'That session time is not valid.');
  }
  if (endedMs < startedMs) {
    throw new AppError('VALIDATION', 'A session cannot end before it starts.');
  }
  if (!Number.isFinite(input.totalDurationSeconds) || input.totalDurationSeconds < 0) {
    throw new AppError('VALIDATION', 'That session length is not valid.');
  }
  if (!SESSION_STATUSES.includes(input.status)) {
    throw new AppError('VALIDATION', 'That session status is not valid.');
  }
  for (const result of input.results) {
    if (typeof result.exerciseName !== 'string' || result.exerciseName.trim().length === 0) {
      throw new AppError('VALIDATION', 'A session result is missing its exercise name.');
    }
    if (result.completedSets < 0 || result.activeSeconds < 0) {
      throw new AppError('VALIDATION', 'A session result has a negative count.');
    }
    if (result.completedReps !== null && result.completedReps < 0) {
      throw new AppError('VALIDATION', 'A session result has a negative count.');
    }
    if (!RESULT_STATUSES.includes(result.status)) {
      throw new AppError('VALIDATION', 'That exercise result status is not valid.');
    }
  }

  const localDate = localDateFromInstant(input.startedAt);
  const weightKg = await getReferenceWeightKg();
  const estimatedKcal = estimateSessionKcal(input.results, weightKg);
  const sessionId = newId();
  const createdAt = nowIso();
  const db = await getDb();

  await db.transaction(async (tx) => {
    await tx.execute(
      `INSERT INTO sessions (id, started_at, ended_at, local_date, status, total_duration_seconds,
          effort_rating, notes, pain_score, symptom_flags, estimated_kcal, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, '[]', ?, ?)`,
      [
        sessionId,
        input.startedAt,
        input.endedAt,
        localDate,
        input.status,
        Math.round(input.totalDurationSeconds),
        estimatedKcal,
        createdAt,
      ],
    );
    for (let index = 0; index < input.results.length; index += 1) {
      const result = input.results[index];
      await tx.execute(
        `INSERT INTO session_exercise_results (id, session_id, exercise_id, exercise_name,
            planned_sets, planned_reps, planned_duration_seconds, completed_sets, completed_reps,
            active_seconds, status, intensity, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId(),
          sessionId,
          result.exerciseId,
          result.exerciseName,
          result.plannedSets,
          result.plannedReps,
          result.plannedDurationSeconds,
          result.completedSets,
          result.completedReps,
          Math.round(result.activeSeconds),
          result.status,
          result.intensity,
          result.sortOrder ?? index,
        ],
      );
    }
  });

  appEvents.emit('session.saved', { sessionId, localDate, status: input.status });
  return getSession(sessionId);
}

/** API-TRN-009 */
export async function getSession(id: Id): Promise<Session> {
  const db = await getDb();
  const row = await db.queryOne<SessionRow>('SELECT * FROM sessions WHERE id = ?', [id]);
  if (!row) {
    throw new AppError('NOT_FOUND', 'That session is no longer in your history.');
  }
  return toSession(row, await loadResults(db, id));
}

/** API-TRN-010 */
export async function listSessions(opts?: {
  from?: LocalDate;
  to?: LocalDate;
  limit?: number;
}): Promise<Session[]> {
  const db = await getDb();
  const clauses: string[] = [];
  const params: Array<string | number | null> = [];
  if (opts?.from) {
    if (!isValidLocalDate(opts.from)) {
      throw new AppError('VALIDATION', 'That date is not valid.');
    }
    clauses.push('local_date >= ?');
    params.push(opts.from);
  }
  if (opts?.to) {
    if (!isValidLocalDate(opts.to)) {
      throw new AppError('VALIDATION', 'That date is not valid.');
    }
    clauses.push('local_date <= ?');
    params.push(opts.to);
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const limit =
    opts?.limit !== undefined && Number.isInteger(opts.limit) && opts.limit > 0
      ? ` LIMIT ${Math.min(opts.limit, 500)}`
      : '';
  const rows = await db.query<SessionRow>(
    `SELECT * FROM sessions ${where} ORDER BY started_at DESC${limit}`,
    params,
  );
  return Promise.all(rows.map(async (row) => toSession(row, await loadResults(db, row.id))));
}

/** API-TRN-011 */
export async function listSessionsForDate(date: LocalDate): Promise<Session[]> {
  if (!isValidLocalDate(date)) {
    throw new AppError('VALIDATION', 'That date is not valid.');
  }
  return listSessions({ from: date, to: date });
}

/** API-TRN-012 */
export async function updateSessionReflection(
  id: Id,
  patch: {
    effortRating?: number | null;
    notes?: string | null;
    painScore?: number | null;
    symptomFlags?: SymptomFlag[];
  },
): Promise<Session> {
  const current = await getSession(id);
  const effortRating =
    patch.effortRating === undefined ? current.effortRating : patch.effortRating;
  if (
    effortRating !== null &&
    (!Number.isInteger(effortRating) || effortRating < 1 || effortRating > 10)
  ) {
    throw new AppError('VALIDATION', 'Effort must be a whole number from 1 to 10.');
  }
  const painScore = patch.painScore === undefined ? current.painScore : patch.painScore;
  if (
    painScore !== null &&
    (!Number.isInteger(painScore) || painScore < 0 || painScore > 10)
  ) {
    throw new AppError('VALIDATION', 'Pain must be a whole number from 0 to 10.');
  }
  const notes = patch.notes === undefined ? current.notes : patch.notes;
  if (notes !== null && typeof notes === 'string' && notes.length > 2000) {
    throw new AppError('VALIDATION', 'Notes must be 2000 characters or fewer.');
  }
  const symptomFlags = patch.symptomFlags === undefined ? current.symptomFlags : patch.symptomFlags;

  const db = await getDb();
  await db.execute(
    'UPDATE sessions SET effort_rating = ?, notes = ?, pain_score = ?, symptom_flags = ? WHERE id = ?',
    [effortRating, notes, painScore, JSON.stringify(symptomFlags), id],
  );
  return getSession(id);
}

/** API-TRN-013 — results cascade away with the session. */
export async function deleteSession(id: Id): Promise<void> {
  const db = await getDb();
  const result = await db.execute('DELETE FROM sessions WHERE id = ?', [id]);
  if (result.changes === 0) {
    throw new AppError('NOT_FOUND', 'That session is no longer in your history.');
  }
}

/** API-TRN-014 */
export async function getSessionDayStatus(date: LocalDate): Promise<SessionDayStatus> {
  if (!isValidLocalDate(date)) {
    throw new AppError('VALIDATION', 'That date is not valid.');
  }
  const scheduled = await listExercisesScheduledFor(date);
  const sessions = await listSessionsForDate(date);
  return {
    localDate: date,
    scheduledExerciseCount: scheduled.length,
    completedSessionCount: sessions.filter((s) => s.status === 'completed').length,
    stoppedSessionCount: sessions.filter((s) => s.status === 'stopped').length,
  };
}

/** API-TRN-015 */
export async function getCompletedSessionCountsByDate(
  from: LocalDate,
  to: LocalDate,
): Promise<Record<LocalDate, number>> {
  if (!isValidLocalDate(from) || !isValidLocalDate(to)) {
    throw new AppError('VALIDATION', 'That date is not valid.');
  }
  const db = await getDb();
  const rows = await db.query<{ local_date: string; total: number }>(
    `SELECT local_date, COUNT(*) AS total FROM sessions
      WHERE status = 'completed' AND local_date BETWEEN ? AND ?
      GROUP BY local_date`,
    [from, to],
  );
  const out: Record<LocalDate, number> = {};
  for (const row of rows) {
    out[row.local_date] = Number(row.total);
  }
  return out;
}