/**
 * INTEGRATION CONTRACT: API-CORE-005
 * Purpose: the only id generator. UUID v4, never a counter, so ids stay unique across restores.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (API-CORE-005)
 * Consumers: training (A2), food (A3), photos (A5), body/journal (A6)
 * Contract status: APPROVED
 */
import * as Crypto from 'expo-crypto';
import type { Id } from '../types/common';

/** API-CORE-005 */
export function newId(): Id {
  try {
    return Crypto.randomUUID();
  } catch {
    const fallback = globalThis.crypto;
    if (fallback && typeof fallback.randomUUID === 'function') {
      return fallback.randomUUID();
    }
    throw new Error('No secure random source is available on this device.');
  }
}