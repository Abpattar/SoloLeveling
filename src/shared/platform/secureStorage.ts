/**
 * INTEGRATION CONTRACT: TYPE-SEC-001, API-SEC-001, API-SEC-002, API-SEC-003
 * Purpose: the ONLY place API keys are stored (Android Keystore via expo-secure-store). Keys never
 *          enter SQLite, backups, logs or source, and are never exported by the backup module.
 * Canonical definition: ERROR_HANDLING_AND_SECURITY.md SEC-06, CONTRACT §7
 * Consumers: nutrition-ai (A4) only
 * Contract status: APPROVED
 */
import * as SecureStore from 'expo-secure-store';
import { toAppError } from '../errors/AppError';

/** TYPE-SEC-001 */
export type SecretKey = 'ai.apiKey.groq' | 'ai.apiKey.gemini';

/** API-SEC-001 */
export async function getSecret(key: SecretKey): Promise<string | null> {
  try {
    const value = await SecureStore.getItemAsync(key);
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch (e) {
    throw toAppError(e, 'STORAGE');
  }
}

/** API-SEC-002 */
export async function setSecret(key: SecretKey, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (e) {
    throw toAppError(e, 'STORAGE');
  }
}

/** API-SEC-003 */
export async function deleteSecret(key: SecretKey): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (e) {
    throw toAppError(e, 'STORAGE');
  }
}