/**
 * INTEGRATION CONTRACT: API-PHOTO-006 .. API-PHOTO-010, API-PHOTO-012, API-PHOTO-013
 * Purpose: progress photos. The lock lives here, in the data layer: a locked photo is returned with
 *          `imageUri: null`, so no screen, log or error can leak its path (SEC-08).
 * Canonical definition: SHARED_CONTRACT.md §10, ERROR_HANDLING_AND_SECURITY SEC-08/SEC-09
 * Consumers: photos screens (A5), Today card (A7 via A5)
 * Contract status: APPROVED
 */
import { getDb } from '@/shared/db/database';
import { AppError, toAppError } from '@/shared/errors/AppError';
// CONTRACT: API-FILE-001/002/003 (A1) — private photo storage
import { deletePhoto, resolvePhotoUri, savePhotoFromUri } from '@/shared/files/photoStorage';
import { localDateFromInstant, nowIso, todayLocal } from '@/shared/utils/dates';
import { newId } from '@/shared/utils/ids';
import { logger } from '@/shared/utils/logger';
import { getDayNumber, getUnlockMilestoneForDay } from '../domain/milestones';
import {
  buildComparisonPairs,
  buildMilestoneStates,
  buildPhotoViews,
  buildTimelineSlots,
} from '../domain/photoViews';
import type { ProgressPhotoRow } from '../domain/photoViews';
import { getActiveJourney, listJourneys, loadEarlyUnlockedDays } from './journeyRepository';
import type { Db } from '@/shared/db/types';
import type { Id, LocalDate } from '@/shared/types/common';
import type {
  AddProgressPhotoInput,
  ComparisonPair,
  Journey,
  MilestoneDay,
  MilestoneState,
  ProgressPhotoView,
  TimelineSlot,
} from '@/shared/types/photos';

interface PhotoRow {
  id: string;
  journey_id: string;
  image_path: string;
  captured_at: string;
  captured_on: string;
  session_id: string | null;
  category: ProgressPhotoView['category'];
}

function toRow(row: PhotoRow): ProgressPhotoRow {
  return {
    id: row.id,
    journeyId: row.journey_id,
    imagePath: row.image_path,
    capturedAt: row.captured_at,
    capturedOn: row.captured_on,
    sessionId: row.session_id,
    category: row.category,
  };
}

async function loadJourneyOrThrow(journeyId: Id): Promise<Journey> {
  const db = await getDb();
  const row = await db.queryOne<{ id: string }>('SELECT id FROM journeys WHERE id = ?', [journeyId]);
  if (!row) {
    throw new AppError('NOT_FOUND', 'That journey is no longer in your list.');
  }
  const journeys = await listJourneys();
  const journey = journeys.find((j) => j.id === journeyId);
  if (!journey) {
    throw new AppError('NOT_FOUND', 'That journey is no longer in your list.');
  }
  return journey;
}

async function loadRows(journeyId: Id, db: Db): Promise<ProgressPhotoRow[]> {
  const rows = await db.query<PhotoRow>(
    'SELECT * FROM progress_photos WHERE journey_id = ? ORDER BY captured_at ASC',
    [journeyId],
  );
  return rows.map(toRow);
}

async function buildContext(journey: Journey, today: LocalDate) {
  return {
    journey,
    today,
    earlyUnlockedDays: await loadEarlyUnlockedDays(journey.id),
  };
}

/** API-PHOTO-006 */
export async function addProgressPhoto(input: AddProgressPhotoInput): Promise<ProgressPhotoView> {
  const journey = await getActiveJourney();
  if (journey === null) {
    throw new AppError('NOT_FOUND', 'There is no journey in progress yet.');
  }

  const capturedAt = input.capturedAt ?? nowIso();
  const capturedMs = Date.parse(capturedAt);
  if (Number.isNaN(capturedMs)) {
    throw new AppError('VALIDATION', 'That time is not valid.');
  }
  if (capturedMs > Date.now() + 60_000) {
    throw new AppError('VALIDATION', 'A progress photo cannot be from the future.');
  }

  const id = newId();
  const stored = await savePhotoFromUri({
    kind: 'progress',
    id,
    sourceUri: input.tempImageUri,
  });
  const capturedOn = localDateFromInstant(capturedAt);

  const db = await getDb();
  try {
    await db.execute(
      `INSERT INTO progress_photos (id, journey_id, image_path, captured_at, captured_on,
          session_id, category, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        journey.id,
        stored.relativePath,
        capturedAt,
        capturedOn,
        input.sessionId ?? null,
        input.category ?? null,
        nowIso(),
      ],
    );
  } catch (e) {
    // A failed insert must not leave an orphaned photo file behind (ERROR_HANDLING §3.3).
    try {
      await deletePhoto(stored.relativePath);
    } catch {
      // The row never existed, so the database stays consistent either way.
    }
    throw toAppError(e, 'STORAGE');
  }

  const views = await listProgressPhotos(journey.id);
  const created = views.find((view) => view.id === id);
  if (!created) {
    throw new AppError('STORAGE', 'That photo could not be saved.');
  }
  return created;
}

/** API-PHOTO-007 — every photo, oldest first; locked ones carry `visible: false` and no URI. */
export async function listProgressPhotos(journeyId: Id): Promise<ProgressPhotoView[]> {
  const journey = await loadJourneyOrThrow(journeyId);
  const db = await getDb();
  const rows = await loadRows(journeyId, db);
  const context = await buildContext(journey, todayLocal());
  return buildPhotoViews(rows, context, resolvePhotoUri);
}

/** API-PHOTO-008 */
export async function getMilestoneStates(journeyId: Id): Promise<MilestoneState[]> {
  const journey = await loadJourneyOrThrow(journeyId);
  const db = await getDb();
  const rows = await loadRows(journeyId, db);
  const context = await buildContext(journey, todayLocal());
  const views = buildPhotoViews(rows, context, resolvePhotoUri);
  return buildMilestoneStates(views, context);
}

/** API-PHOTO-009 — deliberate, confirmed, and only for the NEXT pending milestone (SEC-09). */
export async function unlockMilestoneEarly(
  journeyId: Id,
  day: MilestoneDay,
  opts: { confirmed: boolean },
): Promise<void> {
  const states = await getMilestoneStates(journeyId);
  const state = states.find((s) => s.day === day);
  if (!state) {
    throw new AppError('VALIDATION', 'That milestone does not exist.');
  }
  if (state.unlocked) {
    throw new AppError('CONFLICT', 'That milestone is already unlocked.');
  }
  if (!state.isNextPending) {
    throw new AppError('VALIDATION', 'Only the next milestone can be unlocked early.');
  }
  if (opts?.confirmed !== true) {
    throw new AppError('VALIDATION', 'Confirm before unlocking early.');
  }

  const db = await getDb();
  await db.execute(
    'INSERT OR REPLACE INTO early_unlocks (journey_id, milestone_day, unlocked_at) VALUES (?, ?, ?)',
    [journeyId, day, nowIso()],
  );
}

/** API-PHOTO-010 — removes the row and the file. */
export async function deleteProgressPhoto(id: Id): Promise<void> {
  const db = await getDb();
  const row = await db.queryOne<{ image_path: string }>(
    'SELECT image_path FROM progress_photos WHERE id = ?',
    [id],
  );
  if (!row) {
    throw new AppError('NOT_FOUND', 'That photo is no longer in your list.');
  }
  await db.execute('DELETE FROM progress_photos WHERE id = ?', [id]);
  try {
    await deletePhoto(row.image_path);
  } catch (e) {
    logger.warn('A deleted progress photo could not be removed from storage.', {
      error: String(toAppError(e)),
    });
  }
}

/** API-PHOTO-012 */
export async function getComparisonPairs(journeyId: Id): Promise<ComparisonPair[]> {
  const journey = await loadJourneyOrThrow(journeyId);
  const db = await getDb();
  const rows = await loadRows(journeyId, db);
  const context = await buildContext(journey, todayLocal());
  const views = buildPhotoViews(rows, context, resolvePhotoUri);
  return buildComparisonPairs(views, context);
}

/** API-PHOTO-013 */
export async function getTimelineSlots(
  journeyId: Id,
  days: readonly number[],
): Promise<TimelineSlot[]> {
  const journey = await loadJourneyOrThrow(journeyId);
  const db = await getDb();
  const rows = await loadRows(journeyId, db);
  const context = await buildContext(journey, todayLocal());
  const views = buildPhotoViews(rows, context, resolvePhotoUri);
  return buildTimelineSlots(views, days);
}

/** INTERNAL-WORKAROUND (A5): photo export needs the same visibility decision without a view list. */
export async function isPhotoVisible(id: Id): Promise<boolean> {
  const db = await getDb();
  const row = await db.queryOne<PhotoRow>('SELECT * FROM progress_photos WHERE id = ?', [id]);
  if (!row) {
    throw new AppError('NOT_FOUND', 'That photo is no longer in your list.');
  }
  const journey = await loadJourneyOrThrow(row.journey_id);
  const context = await buildContext(journey, todayLocal());
  const [view] = buildPhotoViews([toRow(row)], context, resolvePhotoUri);
  return view?.visible === true;
}

/** INTERNAL-WORKAROUND (A5): the stored relative path, used only by the export service. */
export async function getPhotoRelativePath(id: Id): Promise<string> {
  const db = await getDb();
  const row = await db.queryOne<{ image_path: string }>(
    'SELECT image_path FROM progress_photos WHERE id = ?',
    [id],
  );
  if (!row) {
    throw new AppError('NOT_FOUND', 'That photo is no longer in your list.');
  }
  return row.image_path;
}

/** INTERNAL-WORKAROUND (A5): unlocks that are ahead of the next pending milestone are ignored. */
export function dayNumberFor(
  journey: Journey,
  capturedOn: LocalDate,
): number {
  return getDayNumber(journey.startDate, capturedOn) as number;
}

/** INTERNAL-WORKAROUND (A5): exposed so the capture screen can say "hidden until Day N". */
export function milestoneForDayNumber(dayNumber: number): MilestoneDay | null {
  return getUnlockMilestoneForDay(dayNumber);
}