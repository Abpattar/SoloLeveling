/** @jest-environment node */
import {
  backupFolderName,
  BACKUP_FORMAT_VERSION,
  buildManifest,
  DATA_FILE_NAME,
  MANIFEST_FILE_NAME,
  toColumnValue,
  validateDataJson,
  validateManifest,
} from '../manifest';

describe('backupFolderName (CONTRACT §8)', () => {
  it('uses RecoveryFitness-Backup-YYYYMMDD-HHmmss with zero padding', () => {
    expect(backupFolderName(new Date(2026, 9, 5, 7, 4, 9))).toBe(
      'RecoveryFitness-Backup-20261005-070409',
    );
  });
});

describe('buildManifest (internal)', () => {
  it('records the schema version, counts and photo count', () => {
    const manifest = buildManifest({
      appSchemaVersion: 1,
      appVersion: '1.0.0',
      tables: { profile: 1, food_entries: 3 },
      photoCount: 2,
    });
    expect(manifest.formatVersion).toBe(1);
    expect(manifest.appSchemaVersion).toBe(1);
    expect(manifest.tables).toEqual({ profile: 1, food_entries: 3 });
    expect(manifest.photoCount).toBe(2);
    expect(typeof manifest.createdAt).toBe('string');
  });

  it('produces a manifest that validates', () => {
    const manifest = buildManifest({
      appSchemaVersion: 1,
      appVersion: '1.0.0',
      tables: {},
      photoCount: 0,
    });
    const result = validateManifest(manifest);
    expect(result.ok).toBe(true);
  });
});

describe('validateManifest (GAT-036)', () => {
  const valid = {
    formatVersion: 1,
    appSchemaVersion: 1,
    createdAt: '2026-10-12T04:30:00.000Z',
    appVersion: '1.0.0',
    tables: { profile: 1 },
    photoCount: 0,
  };

  it('accepts a valid manifest', () => {
    expect(validateManifest(valid).ok).toBe(true);
  });

  it('rejects a different format version as UNSUPPORTED', () => {
    const result = validateManifest({ ...valid, formatVersion: 2 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('UNSUPPORTED');
    }
  });

  it('rejects a non-integer schema version as UNSUPPORTED', () => {
    for (const appSchemaVersion of ['1', null, 1.5]) {
      const result = validateManifest({ ...valid, appSchemaVersion });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('UNSUPPORTED');
      }
    }
  });

  it('rejects a bad photo count, a bad tables record and a missing field as PARSE_ERROR', () => {
    for (const patch of [
      { photoCount: -1 },
      { photoCount: 'many' },
      { tables: 'none' },
      { tables: { profile: -5 } },
      { tables: { profile: 'one' } },
      { appVersion: 1 },
      { createdAt: null },
    ]) {
      const result = validateManifest({ ...valid, ...patch });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('PARSE_ERROR');
      }
    }
  });

  it('rejects non-objects', () => {
    for (const value of [null, 'x', 42, []]) {
      expect(validateManifest(value).ok).toBe(false);
    }
  });

  it('pins the format version to 1', () => {
    expect(BACKUP_FORMAT_VERSION).toBe(1);
    expect(MANIFEST_FILE_NAME).toBe('manifest.json');
    expect(DATA_FILE_NAME).toBe('data.json');
  });
});

describe('validateDataJson (GAT-036)', () => {
  it('accepts the documented shape', () => {
    const result = validateDataJson({ tables: { profile: [{ id: 1 }], food_entries: [] } });
    expect(result.ok).toBe(true);
  });

  it('rejects a missing tables object', () => {
    expect(validateDataJson({}).ok).toBe(false);
    expect(validateDataJson({ tables: [] }).ok).toBe(false);
    expect(validateDataJson(null).ok).toBe(false);
  });

  it('rejects a table that is not an array of row objects', () => {
    for (const tables of [
      { profile: 'row' },
      { profile: [1, 2] },
      { profile: [null] },
      { profile: [['nested']] },
    ]) {
      const result = validateDataJson({ tables });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('PARSE_ERROR');
      }
    }
  });
});

describe('toColumnValue (internal)', () => {
  it('accepts strings, numbers and null', () => {
    expect(toColumnValue('a')).toBe('a');
    expect(toColumnValue(3)).toBe(3);
    expect(toColumnValue(null)).toBeNull();
    expect(toColumnValue(undefined)).toBeNull();
  });

  it('refuses objects, arrays and booleans so they never reach SQL', () => {
    expect(toColumnValue({ a: 1 })).toBeUndefined();
    expect(toColumnValue([1])).toBeUndefined();
    expect(toColumnValue(true)).toBeUndefined();
  });
});