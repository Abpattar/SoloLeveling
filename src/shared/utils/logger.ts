/**
 * INTEGRATION CONTRACT: API-CORE-007
 * Purpose: the ONLY logger in the app. Redacts URIs, paths, images, base64, keys and note text
 *          before anything reaches the console. `debug` is a no-op outside __DEV__.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (API-CORE-007), ERROR_HANDLING_AND_SECURITY SEC-07
 * Consumers: every module
 * Contract status: APPROVED
 */

const REDACTED = '[redacted]';
const REDACT_KEY = /uri|path|image|base64|api[_-]?key|authorization|token|secret|note|password/i;
const MAX_DEPTH = 4;
const MAX_STRING_LENGTH = 200;

function sanitizeValue(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (depth >= MAX_DEPTH) {
    return '[truncated]';
  }
  if (typeof value === 'string') {
    return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}…` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (value instanceof Error) {
    // Never walk an Error's cause chain: provider payloads may contain prompts or image data.
    return { name: value.name, message: value.message };
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = REDACT_KEY.test(key) ? REDACTED : sanitizeValue(item, depth + 1);
    }
    return out;
  }
  return '[unsupported]';
}

function write(level: 'debug' | 'info' | 'warn' | 'error', message: string, ctx?: unknown): void {
  if (level === 'debug' && !__DEV__) {
    return;
  }
  const sanitized = ctx === undefined ? '' : ` ${JSON.stringify(sanitizeValue(ctx, 0))}`;
  // eslint-disable-next-line no-console -- this is the single sanctioned logging sink.
  console[level](`[${level}] ${message}${sanitized}`);
}

export const logger = {
  debug(message: string, ctx?: Record<string, unknown>): void {
    write('debug', message, ctx);
  },
  info(message: string, ctx?: Record<string, unknown>): void {
    write('info', message, ctx);
  },
  warn(message: string, ctx?: Record<string, unknown>): void {
    write('warn', message, ctx);
  },
  error(message: string, ctx?: Record<string, unknown>): void {
    write('error', message, ctx);
  },
};