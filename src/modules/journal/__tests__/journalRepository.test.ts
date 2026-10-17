/** @jest-environment node */
import { createTestDb } from '@/shared/db/testing/createTestDb';
import { setDbForTesting } from '@/shared/db/database';
import { AppError } from '@/shared/errors/AppError';
import { addDays } from '@/shared/utils/dates';
import {
  createJournalEntry,
  deleteJournalEntry,
  getJournalEntriesForDate,
  getJournalEntry,
  listJournalEntries,
  updateJournalEntry,
} from '../data/journalRepository';
import type { JournalEntryInput } from '@/shared/types/journal';

const today = new Date().toISOString().slice(0, 10);

beforeEach(async () => {
  setDbForTesting(await createTestDb());
});

function input(overrides: Partial<JournalEntryInput> = {}): JournalEntryInput {
  return {
    localDate: today,
    painScore: 3,
    stiffnessScore: null,
    swellingLevel: null,
    symptomFlags: [],
    notes: null,
    ...overrides,
  };
}

describe('createJournalEntry', () => {
  it('stores an entry and returns it', async () => {
    const saved = await createJournalEntry(input({ notes: 'slept well' }));

    expect(saved.notes).toBe('slept well');
    expect(saved.painScore).toBe(3);
    expect(saved.localDate).toBe(today);
  });

  it('requires at least one field', async () => {
    await expect(
      createJournalEntry(
        input({ painScore: null, stiffnessScore: null, notes: null, symptomFlags: [] }),
      ),
    ).rejects.toThrow(AppError);
  });

  it('accepts a single symptom flag as the only content', async () => {
    const saved = await createJournalEntry(
      input({ painScore: null, symptomFlags: ['sharp_or_increasing_pain'] }),
    );

    expect(saved.symptomFlags).toEqual(['sharp_or_increasing_pain']);
  });

  it('accepts only a note as content', async () => {
    const saved = await createJournalEntry(
      input({ painScore: null, notes: 'felt stiff' }),
    );

    expect(saved.notes).toBe('felt stiff');
  });

  it('rejects a pain score outside 0-10', async () => {
    await expect(createJournalEntry(input({ painScore: 11 }))).rejects.toThrow(AppError);
    await expect(createJournalEntry(input({ painScore: -1 }))).rejects.toThrow(AppError);
  });

  it('rejects a non-integer score', async () => {
    await expect(createJournalEntry(input({ painScore: 3.5 }))).rejects.toThrow(AppError);
  });

  it('rejects an unknown swelling level', async () => {
    await expect(
      createJournalEntry(input({ swellingLevel: 'extreme' as never })),
    ).rejects.toThrow(AppError);
  });

  it('rejects a note longer than 4000 characters', async () => {
    await expect(createJournalEntry(input({ notes: 'a'.repeat(4001) }))).rejects.toThrow(AppError);
  });

  it('stores an empty note as null', async () => {
    const saved = await createJournalEntry(input({ notes: '   ' }));

    expect(saved.notes).toBeNull();
  });

  it('rejects a future date', async () => {
    const tomorrow = addDays(today, 1);

    await expect(createJournalEntry(input({ localDate: tomorrow }))).rejects.toThrow(AppError);
  });

  it('rejects a malformed date', async () => {
    await expect(createJournalEntry(input({ localDate: '10-03-2026' as never }))).rejects.toThrow(
      AppError,
    );
  });
});

describe('listJournalEntries', () => {
  it('returns newest first', async () => {
    await createJournalEntry(input({ localDate: addDays(today, -2), notes: 'oldest' }));
    await createJournalEntry(input({ localDate: addDays(today, -1), notes: 'middle' }));
    await createJournalEntry(input({ localDate: today, notes: 'newest' }));

    const all = await listJournalEntries();
    expect(all.map((e) => e.notes)).toEqual(['newest', 'middle', 'oldest']);
  });

  it('filters by date range', async () => {
    await createJournalEntry(input({ localDate: addDays(today, -5), notes: 'a' }));
    await createJournalEntry(input({ localDate: addDays(today, -1), notes: 'b' }));

    const inRange = await listJournalEntries({
      from: addDays(today, -2),
      to: today,
    });
    expect(inRange.map((e) => e.notes)).toEqual(['b']);
  });

  it('applies a limit', async () => {
    await createJournalEntry(input({ notes: 'a' }));
    await createJournalEntry(input({ localDate: addDays(today, -1), notes: 'b' }));

    expect(await listJournalEntries({ limit: 1 })).toHaveLength(1);
  });

  it('returns every entry for one date', async () => {
    await createJournalEntry(input({ notes: 'morning' }));
    await createJournalEntry(input({ notes: 'evening' }));
    await createJournalEntry(input({ localDate: addDays(today, -1), notes: 'yesterday' }));

    const forToday = await getJournalEntriesForDate(today);
    expect(forToday).toHaveLength(2);
  });

  it('rejects a malformed range', async () => {
    await expect(listJournalEntries({ from: 'nope' as never })).rejects.toThrow(AppError);
  });
});

describe('updateJournalEntry', () => {
  it('replaces the recorded values', async () => {
    const saved = await createJournalEntry(input({ painScore: 3, notes: 'first' }));

    const updated = await updateJournalEntry(
      saved.id,
      input({ painScore: 6, notes: 'second' }),
    );

    expect(updated.painScore).toBe(6);
    expect(updated.notes).toBe('second');
  });

  it('still requires at least one field after an update', async () => {
    const saved = await createJournalEntry(input());

    await expect(
      updateJournalEntry(saved.id, input({ painScore: null, notes: null, symptomFlags: [] })),
    ).rejects.toThrow(AppError);
  });

  it('rejects an update of an unknown id', async () => {
    await expect(updateJournalEntry('missing', input())).rejects.toThrow(AppError);
  });
});

describe('deleteJournalEntry', () => {
  it('removes the entry', async () => {
    const saved = await createJournalEntry(input());

    await deleteJournalEntry(saved.id);

    expect(await listJournalEntries()).toEqual([]);
    await expect(getJournalEntry(saved.id)).rejects.toThrow(AppError);
  });

  it('rejects deleting an unknown id', async () => {
    await expect(deleteJournalEntry('missing')).rejects.toThrow(AppError);
  });
});