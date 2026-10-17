/** @jest-environment node */
import { AppError } from '../../errors/AppError';
import {
  getPhotoRootUri,
  photoExists,
  resolvePhotoUri,
  savePhotoFromUri,
} from '../photoStorage';

jest.mock('expo-file-system', () => {
  class FakeFile {
    readonly uri: string;
    exists = false;
    size = 0;
    constructor(...parts: Array<string | { uri: string }>) {
      this.uri = parts.map((p) => (typeof p === 'string' ? p : p.uri).replace(/\/$/, '')).join('/');
    }
    create(): void {}
    delete(): void {}
    write(): void {}
    async copy(): Promise<void> {}
  }
  class FakeDirectory {
    readonly uri: string;
    exists = true;
    constructor(...parts: Array<string | { uri: string }>) {
      this.uri = parts.map((p) => (typeof p === 'string' ? p : p.uri).replace(/\/$/, '')).join('/');
    }
    create(): void {}
    createDirectory(name: string): FakeDirectory {
      return new FakeDirectory(this.uri, name);
    }
    list(): Array<FakeFile | FakeDirectory> {
      return [];
    }
    delete(): void {}
    async move(): Promise<void> {}
  }
  return {
    File: FakeFile,
    Directory: FakeDirectory,
    Paths: { document: { uri: 'file:///data/user/0/app/files' } },
  };
});

describe('photo path safety (API-FILE-002, SEC-10)', () => {
  const badPaths = [
    '',
    '/food/abc.jpg',
    'file:///data/food/abc.jpg',
    'content://media/abc.jpg',
    'food/../../../etc/passwd',
    'food\\abc.jpg',
    'food/abc.jpg/extra',
    'foo/abc.jpg',
    'progress',
    'food/.nomedia',
  ];

  it.each(badPaths)('rejects the unsafe relative path %p', (path) => {
    expect(() => resolvePhotoUri(path)).toThrow(AppError);
  });

  it('accepts only food/<id>.jpg and progress/<id>.jpg', () => {
    expect(resolvePhotoUri('food/abc.jpg')).toBe(
      'file:///data/user/0/app/files/private-media/food/abc.jpg',
    );
    expect(resolvePhotoUri('progress/def.jpg')).toBe(
      'file:///data/user/0/app/files/private-media/progress/def.jpg',
    );
  });

  it('reports an unsafe path as a non-existent photo rather than throwing', async () => {
    await expect(photoExists('food/../secret')).resolves.toBe(false);
  });
});

describe('getPhotoRootUri (API-FILE-009)', () => {
  it('returns the live root with a trailing slash', () => {
    expect(getPhotoRootUri()).toBe('file:///data/user/0/app/files/private-media/');
  });
});

describe('savePhotoFromUri (API-FILE-001)', () => {
  it('rejects an unsafe id before touching the filesystem', async () => {
    await expect(
      savePhotoFromUri({ kind: 'food', id: '../escape', sourceUri: 'file:///tmp/x.jpg' }),
    ).rejects.toThrow(AppError);
  });

  it('rejects an unknown kind', async () => {
    await expect(
      savePhotoFromUri({ kind: 'other' as never, id: 'abc', sourceUri: 'file:///tmp/x.jpg' }),
    ).rejects.toThrow(AppError);
  });

  it('rejects an empty source uri', async () => {
    await expect(savePhotoFromUri({ kind: 'food', id: 'abc', sourceUri: '' })).rejects.toThrow(
      AppError,
    );
  });
});