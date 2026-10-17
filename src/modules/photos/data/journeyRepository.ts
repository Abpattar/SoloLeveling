/**
 * INTEGRATION CONTRACT: API-PHOTO-001 .. API-PHOTO-005
 * Purpose: Journeys. A journey is one 90-day block starting at a chosen date. Exactly one is active
 *          at a time (the database enforces it too), and starting the next one requires the current
 *          journey's Day 90 to be unlocked — by date or by a deliberate early unlock.
 * Canonical definition: SHARED_CONTRACT.md §10
 * Consumers: onboarding (A7), Photos screens (A5), Today card (A7 via A5)
 * Contract status: APPROVED
 */
import { getDb } from '@/shared/db/database';
import { AppError } from '@/shared/errors/AppError';
import { getDayNumber, isValidLocalDate, nowIso, todayLocal } from '@/shared/utils/dates';
import { newId } from '@/shared/utils/ids';
import { isMilestoneUnlocked } from '../domain/milestones';
import type { Id, LocalDate } from '@/shared/types/common';
import type { Journey, JourneyStatus, MilestoneDay } from '@/shared/types/photos';

interface JourneyRow {
  id: string;
  number: number;
  start_date: string;
  status: string;
  completed_on: string | null;
  created_at: string;
  updated_at: string;
}

function toJourney(row: JourneyRow): Journey {
  return {
    id: row.id,
    number: Number(row.number),
    startDate: row.start_date,
    status: row.status as JourneyStatus,
    completedOn: row.completed_on,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadById(id: Id): Promise<Journey> {
  const db = await getDb();
  const row = await db.queryOne<JourneyRow>('SELECT * FROM journeys WHERE id = ?', [id]);
  if (!row) {
    throw new AppError('NOT_FOUND', 'That journey is no longer in your list.');
  }
  return toJourney(row);
}

export async function loadEarlyUnlockedDays(journeyId: Id): Promise<MilestoneDay[]> {
  const db = await getDb();
  const rows = await db.query<{ milestone_day: number }>(
    'SELECT milestone_day FROM early_unlocks WHERE journey_id = ?',
    [journeyId],
  );
  return rows.map((row) => Number(row.milestone_day) as MilestoneDay);
}

/** API-PHOTO-001 */
export async function getActiveJourney(): Promise<Journey | null> {
  const db = await getDb();
  const row = await db.queryOne<JourneyRow>("SELECT * FROM journeys WHERE status = 'active'");
  return row ? toJourney(row) : null;
}

/** API-PHOTO-002 */
export async function createFirstJourney(startDate: LocalDate): Promise<Journey> {
  if (!isValidLocalDate(startDate)) {
    throw new AppError('VALIDATION', 'That start date is not valid.');
  }
  if (startDate > todayLocal()) {
    throw new AppError('VALIDATION', 'Day 1 cannot be in the future.');
  }
  const existing = await listJourneys();
  if (existing.length > 0) {
    throw new AppError('CONFLICT', 'A journey already exists.');
  }
  const db = await getDb();
  const id = newId();
  const ts = nowIso();
  await db.execute(
    `INSERT INTO journeys (id, number, start_date, status, completed_on, created_at, updated_at)
     VALUES (?, 1, ?, 'active', NULL, ?, ?)`,
    [id, startDate, ts, ts],
  );
  return loadById(id);
}

/** API-PHOTO-003 */
export async function listJourneys(): Promise<Journey[]> {
  const db = await getDb();
  const rows = await db.query<JourneyRow>('SELECT * FROM journeys ORDER BY number ASC');
  return rows.map(toJourney);
}

/** API-PHOTO-004 */
export async function updateJourneyStartDate(
  journeyId: Id,
  newStartDate: LocalDate,
): Promise<Journey> {
  if (!isValidLocalDate(newStartDate)) {
    throw new AppError('VALIDATION', 'That start date is not valid.');
  }
  const today = todayLocal();
  if (newStartDate > today) {
    throw new AppError('VALIDATION', 'Day 1 cannot be in the future.');
  }

  const journey = await loadById(journeyId);
  const db = await getDb();

  // No existing photo may fall before Day 1 after the change.
  const photos = await db.query<{ captured_on: string }>(
    'SELECT captured_on FROM progress_photos WHERE journey_id = ?',
    [journeyId],
  );
  for (const photo of photos) {
    if (getDayNumber(newStartDate, photo.captured_on) < 1) {
      throw new AppError(
        'VALIDATION',
        'A photo you already took would fall before Day 1. Choose a later start date.',
      );
    }
  }

  // For journey N > 1 the start may not precede the previous journey's completion.
  if (journey.number > 1) {
    const previous = await db.queryOne<JourneyRow>(
      'SELECT * FROM journeys WHERE number = ?',
      [journey.number - 1],
    );
    if (previous?.completed_on && newStartDate < previous.completed_on) {
      throw new AppError(
        'VALIDATION',
        'This journey cannot start before the previous one finished.',
      );
    }
  }

  await db.execute('UPDATE journeys SET start_date = ?, updated_at = ? WHERE id = ?', [
    newStartDate,
    nowIso(),
    journeyId,
  ]);
  return loadById(journeyId);
}

/** API-PHOTO-005 — one transaction: complete the current journey, insert the next one. */
export async function startNextJourney(): Promise<Journey> {
  const today = todayLocal();
  const active = await getActiveJourney();
  if (active === null) {
    throw new AppError('CONFLICT', 'There is no journey in progress.');
  }

  const earlyUnlockedDays = await loadEarlyUnlockedDays(active.id);
  const day90Unlocked = isMilestoneUnlocked({
    startDate: active.startDate,
    today,
    day: 90,
    earlyUnlockedDays,
  });
  if (!day90Unlocked) {
    throw new AppError(
      'CONFLICT',
      'Journey 90 must be unlocked before you can start the next journey.',
    );
  }

  const db = await getDb();
  const id = newId();
  const ts = nowIso();
  await db.transaction(async (tx) => {
    await tx.execute(
      "UPDATE journeys SET status = 'completed', completed_on = ?, updated_at = ? WHERE id = ?",
      [today, ts, active.id],
    );
    await tx.execute(
      `INSERT INTO journeys (id, number, start_date, status, completed_on, created_at, updated_at)
       VALUES (?, ?, ?, 'active', NULL, ?, ?)`,
      [id, active.number + 1, today, ts, ts],
    );
  });
  return loadById(id);
}