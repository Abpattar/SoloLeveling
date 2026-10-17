/** @jest-environment node */
import { createTestDb } from '@/shared/db/testing/createTestDb';
import { getDb, setDbForTesting } from '@/shared/db/database';
import { appEvents } from '@/shared/events/appEvents';
import { getSettings, updateSettings } from '@/shared/settings/settingsRepository';
import { createExercise, saveSession } from '@/modules/training';
import { createFoodEntryFromPhoto } from '@/modules/food';
import { DB_TABLES_IN_RESTORE_ORDER } from '@/shared/db/migrations';
import type { BackupFs } from '../backupFs';

const mockPhotoRoot = 'file:///data/user/0/app/files/private-media/';
const mockStagingRoot = 'file:///data/user/0/app/files/private-media-staging/';
const mockCommitted: string[] = [];
const mockDiscarded: string[] = [];
let mockStagingPrepared = false;

jest.mock('@/shared/files/photoStorage', () => ({
  getPhotoRootUri: () => mockPhotoRoot,
  resolvePhotoUri: (p: string) => {
    if (p.includes('..') || p.includes('://')) {
      throw new Error('bad relative path');
    }
    const segments = p.split('/');
    if (segments.length !== 2) {
      throw new Error('bad relative path');
    }
    return `${mockPhotoRoot}${p}`;
  },
  listStoredPhotos: jest.fn(async () => mockPhotos),
  savePhotoFromUri: jest.fn(async ({ id }: { id: string }) => {
    mockPhotos.push({ relativePath: `food/${id}.jpg`, byteSize: 100 });
    return { relativePath: `food/${id}.jpg`, byteSize: 100 };
  }),
  deletePhoto: jest.fn(async () => undefined),
  photoExists: jest.fn(async () => true),
  prepareStagingPhotoRoot: jest.fn(async () => {
    mockStagingPrepared = true;
    return `${mockStagingRoot}`;
  }),
  commitStagingPhotoRoot: jest.fn(async () => {
    mockCommitted.push('committed');
    mockStagingPrepared = false;
  }),
  discardStagingPhotoRoot: jest.fn(async () => {
    mockDiscarded.push('discarded');
    mockStagingPrepared = false;
  }),
}));

const mockPhotos: Array<{ relativePath: string; byteSize: number }> = [];

/** In-memory backup filesystem: enough to prove the order of operations, with no native code. */
class FakeBackupFs implements BackupFs {
  files = new Map<string, string>();
  copies: Array<{ dir: string; name: string }> = [];
  order: string[] = [];
  pickedUri: string | null = 'content://picked/';
  dismissPicker = false;

  async pickDirectory() {
    if (this.dismissPicker) {
      return null;
    }
    return { uri: this.pickedUri } as never;
  }
  async ensureSubdirectory(parentUri: string, name: string) {
    this.order.push(`mkdir:${name}`);
    return `${parentUri}${name}/`;
  }
  async writeTextFile(directoryUri: string, name: string, contents: string) {
    this.order.push(`write:${name}`);
    this.files.set(`${directoryUri}${name}`, contents);
  }
  async readTextFile(directoryUri: string, name: string) {
    const value = this.files.get(`${directoryUri}${name}`);
    if (value === undefined) {
      throw new Error(`no file ${name} in ${directoryUri}`);
    }
    return value;
  }
  async copyPhotoInto(directoryUri: string, kind: string, fileName: string) {
    this.order.push(`copyIn:${kind}/${fileName}`);
    this.copies.push({ dir: directoryUri, name: fileName });
  }
  async copyPhotoOut(directoryUri: string, kind: string, fileName: string) {
    this.order.push(`copyOut:${kind}/${fileName}`);
    this.copies.push({ dir: directoryUri, name: fileName });
  }
  async listPhotoFiles(directoryUri: string) {
    const prefix = directoryUri.replace(/\/$/, '/');
    return Array.from(this.files.keys())
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length));
  }
  async directoryExists() {
    return true;
  }
}

let mockFakeFs: FakeBackupFs;

jest.mock('../backupFs', () => ({
  getBackupFs: () => mockFakeFs,
  setBackupFs: () => undefined,
}));

import { exportBackup } from '../exporter';
import { previewBackup, restoreBackup } from '../restorer';

beforeEach(async () => {
  setDbForTesting(await createTestDb());
  mockPhotos.length = 0;
  mockCommitted.length = 0;
  mockDiscarded.length = 0;
  mockStagingPrepared = false;
  mockFakeFs = new FakeBackupFs();
});

afterEach(() => {
  setDbForTesting(null);
});

async function seedData(): Promise<void> {
  const exercise = await createExercise({
    name: 'Straight leg raise',
    sets: 3,
    reps: 10,
    restSeconds: 60,
    scheduleDays: [1],
    intensity: 'light',
  });
  await saveSession({
    startedAt: '2026-10-12T12:00:00.000Z',
    endedAt: '2026-10-12T12:20:00.000Z',
    status: 'completed',
    totalDurationSeconds: 1200,
    results: [
      {
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        plannedSets: 3,
        plannedReps: 10,
        plannedDurationSeconds: null,
        completedSets: 3,
        completedReps: 30,
        activeSeconds: 600,
        status: 'completed',
        intensity: 'light',
        sortOrder: 0,
      },
    ],
  });
  await createFoodEntryFromPhoto({
    mealCategoryId: 'meal-lunch',
    tempImageUri: 'file:///tmp/x.jpg',
    capturedAt: '2026-10-12T13:00:00.000Z',
  });
}

async function seedBackupFolder(fs: FakeBackupFs, overrides: Record<string, unknown> = {}): Promise<string> {
  const folder = 'content://picked/RecoveryFitness-Backup-20261012-120000/';
  const tables: Record<string, Array<Record<string, unknown>>> = {};
  const db = await getDb();
  for (const table of DB_TABLES_IN_RESTORE_ORDER) {
    tables[table] = await db.query<Record<string, unknown>>(`SELECT * FROM ${table}`);
  }
  await fs.writeTextFile(folder, 'data.json', JSON.stringify({ tables }));
  await fs.writeTextFile(folder, 'manifest.json', JSON.stringify({
    formatVersion: 1,
    appSchemaVersion: 1,
    createdAt: '2026-10-12T12:00:00.000Z',
    appVersion: '1.0.0',
    tables: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length])),
    photoCount: overrides.photoCount ?? 1,
    ...overrides,
  }));
  for (const photo of mockPhotos) {
    const [kind, name] = photo.relativePath.split('/') as [string, string];
    await fs.files.set(`${folder}photos/${kind}/${name}`, 'binary');
  }
  return folder;
}

describe('exportBackup (API-BKP-001, GAT-034)', () => {
  it('returns CANCELLED when the picker is dismissed', async () => {
    mockFakeFs.dismissPicker = true;
    const result = await exportBackup();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('CANCELLED');
    }
  });

  it('writes data.json then the manifest last', async () => {
    await seedData();
    const result = await exportBackup();
    expect(result.ok).toBe(true);
    const writes = mockFakeFs.order.filter((entry) => entry.startsWith('write:'));
    expect(writes).toEqual(['write:data.json', 'write:manifest.json']);
  });

  it('reports row counts that match the database', async () => {
    await seedData();
    const result = await exportBackup();
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const db = await getDb();
    for (const table of DB_TABLES_IN_RESTORE_ORDER) {
      const rows = await db.query(`SELECT * FROM ${table}`);
      expect(result.value.tableRowCounts[table]).toBe(rows.length);
    }
    expect(result.value.tableRowCounts.food_entries).toBe(1);
    expect(result.value.folderName).toMatch(/^RecoveryFitness-Backup-\d{8}-\d{6}$/);
  });

  it('copies every stored photo into the folder', async () => {
    await seedData();
    const result = await exportBackup();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.photoCount).toBe(mockPhotos.length);
      expect(result.value.totalBytes).toBeGreaterThan(0);
    }
    expect(mockFakeFs.order.some((entry) => entry.startsWith('copyIn:food/'))).toBe(true);
  });

  it('reports progress for every phase', async () => {
    await seedData();
    const phases = new Set<string>();
    await exportBackup({ onProgress: (p) => phases.add(p.phase) });
    expect(phases).toEqual(new Set(['database', 'photos', 'finalizing']));
  });

  it('never writes an API key', async () => {
    await updateSettings({ ai: { modelOverride: 'a-model' } });
    await seedData();
    await exportBackup();
    for (const contents of mockFakeFs.files.values()) {
      expect(contents).not.toMatch(/apiKey|api_key|sk-[A-Za-z0-9]/i);
    }
  });
});

describe('previewBackup (API-BKP-002)', () => {
  it('returns CANCELLED when the picker is dismissed', async () => {
    mockFakeFs.dismissPicker = true;
    const result = await previewBackup();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('CANCELLED');
    }
  });

  it('returns the manifest for a valid folder', async () => {
    await seedData();
    const folder = await seedBackupFolder(mockFakeFs);
    mockFakeFs.pickedUri = folder;
    const result = await previewBackup();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.manifest.appSchemaVersion).toBe(1);
      expect(result.value.manifest.tables.food_entries).toBe(1);
    }
  });

  it('rejects a folder with no manifest', async () => {
    mockFakeFs.pickedUri = 'content://picked/empty/';
    const result = await previewBackup();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PARSE_ERROR');
    }
  });
});

describe('restoreBackup (API-BKP-003, GAT-035/036)', () => {
  it('refuses without explicit confirmation', async () => {
    await seedData();
    const folder = await seedBackupFolder(mockFakeFs);
    const result = await restoreBackup(folder, { confirmed: false });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION');
    }
    expect(mockCommitted).toHaveLength(0);
  });

  it('round-trips rows and preserves dates', async () => {
    await seedData();
    const folder = await seedBackupFolder(mockFakeFs);
    const before = await (await getDb()).query('SELECT * FROM sessions');

    await createExercise({ name: 'Added after the backup', sets: 1, reps: 5, scheduleDays: [2] });
    const result = await restoreBackup(folder, { confirmed: true });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.restoredTables.food_entries).toBe(1);
      expect(result.value.restoredPhotoCount).toBe(1);
    }
    const after = await (await getDb()).query('SELECT * FROM sessions');
    expect(after).toEqual(before);
    const exercises = await (await getDb()).query<{ name: string }>(
      'SELECT name FROM exercises ORDER BY name',
    );
    expect(exercises.map((e) => e.name)).toEqual(['Straight leg raise']);
  });

  it('preserves journeys and early unlocks verbatim', async () => {
    const db = await getDb();
    await db.execute(
      `INSERT INTO journeys (id, number, start_date, status, completed_on, created_at, updated_at)
       VALUES ('j1', 1, '2026-01-01', 'completed', '2026-04-01', 'x', 'x')`,
    );
    await db.execute(
      "INSERT INTO early_unlocks (journey_id, milestone_day, unlocked_at) VALUES ('j1', 30, 'x')",
    );
    const folder = await seedBackupFolder(mockFakeFs);
    await restoreBackup(folder, { confirmed: true });
    const journeys = await db.query('SELECT * FROM journeys');
    const unlocks = await db.query('SELECT * FROM early_unlocks');
    expect(journeys).toHaveLength(1);
    expect(journeys[0]?.status).toBe('completed');
    expect(unlocks[0]?.milestone_day).toBe(30);
  });

  it('commits the photo root and emits data.restored on success', async () => {
    await seedData();
    const folder = await seedBackupFolder(mockFakeFs);
    const handler = jest.fn();
    const off = appEvents.on('data.restored', handler);
    const result = await restoreBackup(folder, { confirmed: true });
    off();
    expect(result.ok).toBe(true);
    expect(mockCommitted).toHaveLength(1);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('resets AI consent after a restore', async () => {
    await updateSettings({
      ai: {
        externalAnalysisEnabled: true,
        providerId: 'groq',
        consentGrantedAt: '2026-10-01T00:00:00.000Z',
        consentProviderId: 'groq',
        consentDisclosureVersion: 1,
      },
    });
    const folder = await seedBackupFolder(mockFakeFs);
    await restoreBackup(folder, { confirmed: true });
    const settings = await getSettings();
    expect(settings.ai.externalAnalysisEnabled).toBe(false);
    expect(settings.ai.consentGrantedAt).toBeNull();
    expect(settings.ai.providerId).toBeNull();
  });

  it('rejects a schema-version mismatch and leaves the data untouched', async () => {
    await seedData();
    const before = await (await getDb()).query('SELECT * FROM food_entries');
    const folder = await seedBackupFolder(mockFakeFs, { appSchemaVersion: 99 });
    const result = await restoreBackup(folder, { confirmed: true });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('UNSUPPORTED');
    }
    expect(await (await getDb()).query('SELECT * FROM food_entries')).toEqual(before);
    expect(mockCommitted).toHaveLength(0);
  });

  it('rejects a missing photo and leaves the data untouched', async () => {
    await seedData();
    const before = await (await getDb()).query('SELECT * FROM food_entries');
    const folder = await seedBackupFolder(mockFakeFs);
    for (const key of Array.from(mockFakeFs.files.keys())) {
      if (key.includes('/photos/')) {
        mockFakeFs.files.delete(key);
      }
    }
    const result = await restoreBackup(folder, { confirmed: true });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PARSE_ERROR');
    }
    expect(await (await getDb()).query('SELECT * FROM food_entries')).toEqual(before);
    expect(mockCommitted).toHaveLength(0);
  });

  it('rejects an incomplete data.json and leaves the data untouched', async () => {
    await seedData();
    const before = await (await getDb()).query('SELECT * FROM food_entries');
    const folder = await seedBackupFolder(mockFakeFs);
    mockFakeFs.files.set(`${folder}data.json`, JSON.stringify({ tables: { profile: [] } }));
    const result = await restoreBackup(folder, { confirmed: true });
    expect(result.ok).toBe(false);
    expect(await (await getDb()).query('SELECT * FROM food_entries')).toEqual(before);
  });

  it('rolls back and discards staging when a row cannot be stored', async () => {
    await seedData();
    const folder = await seedBackupFolder(mockFakeFs);
    const tables = JSON.parse(mockFakeFs.files.get(`${folder}data.json`) as string) as {
      tables: Record<string, Array<Record<string, unknown>>>;
    };
    (tables.tables.profile as Array<Record<string, unknown>>).push({
      id: 1,
      height_cm: null,
      unit_system: 'metric',
      baseline_weight_kg: null,
      onboarding_completed: 0,
      disclaimer_acknowledged_at: null,
      created_at: 'x',
      updated_at: 'x',
      // An object column value can never be stored, so the transaction must roll back.
      not_a_real_column: { nested: true },
    });
    mockFakeFs.files.set(`${folder}data.json`, JSON.stringify(tables));
    const before = await (await getDb()).query('SELECT * FROM food_entries');

    const result = await restoreBackup(folder, { confirmed: true });

    expect(result.ok).toBe(false);
    expect(await (await getDb()).query('SELECT * FROM food_entries')).toEqual(before);
    expect(mockCommitted).toHaveLength(0);
    expect(mockDiscarded.length + Number(mockStagingPrepared ? 1 : 0)).toBeGreaterThan(0);
  });
});