/** @jest-environment node */
import { logger } from '../logger';

describe('logger redaction (GAT-020, SEC-07)', () => {
  const sink = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  const info = jest.spyOn(console, 'info').mockImplementation(() => undefined);

  afterEach(() => {
    sink.mockClear();
    info.mockClear();
  });

  afterAll(() => {
    sink.mockRestore();
    info.mockRestore();
  });

  it('redacts uri, path, image, base64, apiKey and note keys', () => {
    logger.info('test', {
      uri: 'file:///data/user/0/app/photo.jpg',
      imagePath: 'food/abc.jpg',
      imageUri: 'file:///x.jpg',
      base64: 'AAAA',
      apiKey: 'sk-secret',
      note: 'private text',
      notes: 'more private text',
      keep: 'visible',
    });
    const printed = String((sink.mock.calls[0] ?? info.mock.calls[0])?.[0] ?? '');
    expect(printed).not.toContain('sk-secret');
    expect(printed).not.toContain('private text');
    expect(printed).not.toContain('file:///');
    expect(printed).not.toContain('AAAA');
    expect(printed).toContain('[redacted]');
    expect(printed).toContain('visible');
  });

  it('redacts nested objects too', () => {
    logger.info('nested', { outer: { filePath: '/secret/path', name: 'x' } });
    const printed = String((sink.mock.calls[0] ?? info.mock.calls[0])?.[0] ?? '');
    expect(printed).not.toContain('/secret/path');
    expect(printed).toContain('x');
  });

  it('never walks an Error cause chain', () => {
    const error = new Error('failed') as Error & { cause?: unknown };
    error.cause = { apiKey: 'sk-leak', prompt: 'meal photo bytes' };
    logger.warn('with error', { error });
    const printed = String(sink.mock.calls[0]?.[0] ?? '');
    expect(printed).toContain('failed');
    expect(printed).not.toContain('sk-leak');
    expect(printed).not.toContain('meal photo bytes');
  });

  it('truncates very long strings', () => {
    logger.info('long', { text: 'x'.repeat(500) });
    const printed = String((sink.mock.calls[0] ?? info.mock.calls[0])?.[0] ?? '');
    expect(printed.length).toBeLessThan(400);
  });
});