/**
 * INTEGRATION CONTRACT: internal (A4 nutrition-ai) — the ONLY file in the app that calls `fetch`
 * Purpose: one HTTPS call site with a hard host allow-list, a 30 s timeout, and an error mapping that
 *          never leaks a body, a key or a URL to the user.
 * Canonical definition: ERROR_HANDLING_AND_SECURITY.md SEC-02/SEC-05, SHARED_CONTRACT §7 step 4
 * Consumers: estimateService.ts
 * Contract status: APPROVED (internal symbol, no registry ID)
 */
import { AppError } from '@/shared/errors/AppError';
import { logger } from '@/shared/utils/logger';

/** SEC-05: the only two hosts the app may ever contact. */
export const ALLOWED_HOSTS = ['api.groq.com', 'generativelanguage.googleapis.com'] as const;

const TIMEOUT_MS = 30_000;

export interface HttpRequest {
  url: string;
  headers: Record<string, string>;
  body: unknown;
  signal?: AbortSignal;
}

export interface HttpResponse {
  status: number;
  text: string;
  json: unknown;
}

/** INTERNAL-WORKAROUND (A4): validates the URL before anything is sent. */
export function assertAllowedUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new AppError('VALIDATION', 'That analysis request could not be built.');
  }
  if (parsed.protocol !== 'https:') {
    throw new AppError('VALIDATION', 'That analysis request could not be built.');
  }
  if (!(ALLOWED_HOSTS as readonly string[]).includes(parsed.hostname)) {
    // The rejected host is deliberately not included: a URL must never reach a message or a log.
    throw new AppError('VALIDATION', 'That analysis service is not allowed.');
  }
}

/**
 * Performs the request. Never throws: every failure is an `AppError` with a short, user-safe message.
 * INTERNAL-WORKAROUND (A4): `fetch` is only ever called here.
 */
export async function postJson(request: HttpRequest): Promise<HttpResponse> {
  assertAllowedUrl(request.url);

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);
  const onCallerAbort = (): void => controller.abort();
  request.signal?.addEventListener('abort', onCallerAbort);

  try {
    const response = await fetch(request.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...request.headers },
      body: JSON.stringify(request.body),
      signal: controller.signal,
    });

    const text = await response.text();
    let json: unknown = null;
    try {
      json = text.length > 0 ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!response.ok) {
      const mapped =
        response.status === 429 ? 'RATE_LIMITED' : 'PROVIDER_ERROR';
      throw new AppError(mapped, messageForStatus(response.status), {
        details: { status: response.status },
      });
    }

    return { status: response.status, text, json };
  } catch (e) {
    throw mapTransportError(e, timedOut, request.signal?.aborted === true);
  } finally {
    clearTimeout(timer);
    request.signal?.removeEventListener('abort', onCallerAbort);
  }
}

function messageForStatus(status: number): string {
  if (status === 429) {
    return 'The analysis service is busy right now. Your photo is saved; try again later.';
  }
  if (status === 401 || status === 403) {
    return 'The analysis service rejected the API key. Check it in Settings.';
  }
  return 'The analysis service could not finish. Your photo is saved; try again.';
}

function mapTransportError(e: unknown, timedOut: boolean, cancelledByCaller: boolean): AppError {
  if (e instanceof AppError) {
    return e;
  }
  if (timedOut) {
    logger.warn('The analysis request timed out.');
    return new AppError('NETWORK', 'The analysis service took too long to answer. Try again.', {
      cause: e,
    });
  }
  if (cancelledByCaller) {
    return new AppError('CANCELLED', 'Analysis was cancelled.', { cause: e });
  }
  if (e instanceof Error && e.name === 'AbortError') {
    return new AppError('CANCELLED', 'Analysis was cancelled.', { cause: e });
  }
  if (e instanceof TypeError) {
    // React Native reports a missing connection as a TypeError from fetch.
    return new AppError('OFFLINE', "Couldn't reach the analysis service. Your photo is saved; try again later.", {
      cause: e,
    });
  }
  logger.warn('The analysis request failed.', { name: e instanceof Error ? e.name : 'unknown' });
  return new AppError('NETWORK', 'The analysis service could not finish. Your photo is saved; try again.', {
    cause: e,
  });
}