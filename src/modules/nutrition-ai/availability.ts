/**
 * INTEGRATION CONTRACT: API-AI-001
 * Purpose: the single gate that decides whether a meal photo may be sent anywhere. It runs a fixed
 *          order so the UI can tell the user exactly what is missing, and it voids consent when the
 *          provider or the disclosure text changes.
 * Canonical definition: SHARED_SYMBOL_REGISTRY.md (API-AI-001), SHARED_CONTRACT §7 (consent rules)
 * Consumers: food (A3) through estimatorBridge, AnalysisSettingsSection.tsx (A4)
 * Contract status: APPROVED
 */
import { getSecret } from '@/shared/platform/secureStorage';
import { getSettings } from '@/shared/settings/settingsRepository';
import { getProviderInfo } from './providers/catalog';
import type { SecretKey } from '@/shared/platform/secureStorage';
import type { AnalysisAvailability } from '@/shared/types/nutritionAi';
import type { AiProviderId } from '@/shared/types/settings';

function secretKeyFor(providerId: AiProviderId): SecretKey {
  return `ai.apiKey.${providerId}`;
}

/** API-AI-001 — order: disabled → no_provider → no_consent → no_api_key → ready. */
export async function getAnalysisAvailability(): Promise<AnalysisAvailability> {
  const settings = await getSettings();
  const ai = settings.ai;

  if (!ai.externalAnalysisEnabled) {
    return { state: 'disabled' };
  }
  if (ai.providerId === null) {
    return { state: 'no_provider' };
  }

  const provider = getProviderInfo(ai.providerId);
  if (provider === null) {
    return { state: 'no_provider' };
  }

  // Consent is void if it was never given, was given for a different provider, or was given
  // against an older disclosure text.
  if (
    ai.consentGrantedAt === null ||
    ai.consentProviderId !== ai.providerId ||
    ai.consentDisclosureVersion !== provider.disclosureVersion
  ) {
    return { state: 'no_consent' };
  }

const apiKey = await getSecret(secretKeyFor(ai.providerId));
  if (apiKey === null || apiKey.trim().length === 0) {
    return { state: 'no_api_key' };
  }

  return { state: 'ready', providerId: ai.providerId };
}

/** API-AI-001 */
export async function getApiKeyForProvider(providerId: AiProviderId): Promise<string | null> {
  return getSecret(secretKeyFor(providerId));
}