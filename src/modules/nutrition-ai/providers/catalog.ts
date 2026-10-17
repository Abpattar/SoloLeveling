/**
 * INTEGRATION CONTRACT: API-AI-003
 * Purpose: the two supported providers and the exact disclosure text the user must read before
 *          giving consent. The wording is binding: it is a privacy disclosure, not marketing copy.
 * Canonical definition: SHARED_CONTRACT.md §7 (catalog verbatim)
 * Consumers: AnalysisSettingsSection.tsx (A4), availability.ts (A4)
 * Contract status: APPROVED
 */
import type { AiProviderInfo } from '@/shared/types/nutritionAi';
import type { AiProviderId } from '@/shared/types/settings';

/** Values are verbatim from SHARED_CONTRACT.md §7. Do not reword. */
export const AI_PROVIDER_CATALOG: AiProviderInfo[] = [
  {
    id: 'groq',
    displayName: 'Groq (free plan available)',
    freeTierSummary:
      'Free plan, no payment card needed. Groq publishes sample limits for its vision model of 30 requests/minute, 1,000 requests/day, 8,000 tokens/minute and 200,000 tokens/day (each image counts about 2,048 input tokens). Limits can change and can be lower for your account.',
    dataHandlingSummary:
      "Groq states it does not retain inference inputs or outputs by default, but may temporarily log them for up to 30 days to troubleshoot reliability or investigate abuse; Zero Data Retention can be turned on in your Groq account (Data Controls). Retained data is stored in the United States. Read Groq's terms for anything else. Your meal photo is sent to Groq over the internet.",
    disclosureVersion: 1,
    docsUrl: 'https://console.groq.com/docs/your-data',
    apiKeyUrl: 'https://console.groq.com/keys',
    // Documented as Groq's vision model on 2026-10-11; model IDs change — re-verify at
    // https://console.groq.com/docs/vision
    defaultModelId: 'qwen/qwen3.8-27b',
    verifiedOn: '2026-10-11',
  },
  {
    id: 'gemini',
    displayName: 'Google Gemini API (free tier available)',
    freeTierSummary:
      'A free tier exists with lower rate limits (see Google AI Studio for your current limits). A paid tier exists; no charge occurs unless you enable billing.',
    dataHandlingSummary:
      'On the FREE tier Google states that your prompts, images and responses may be used to improve its products and that human reviewers may read them. The paid tier does not use your content for product improvement. Availability and terms can vary by region. Your meal photo is sent to Google over the internet.',
    disclosureVersion: 1,
    docsUrl: 'https://ai.google.dev/gemini-api/terms',
    apiKeyUrl: 'https://aistudio.google.com/apikey',
    // Seen listed with a free tier in 2026 sources; NOT re-verified — confirm at
    // https://ai.google.dev/gemini-api/docs/models
    defaultModelId: 'gemini-2.5-flash-lite',
    verifiedOn: '2026-10-11',
  },
];

/** API-AI-003 */
export function listAiProviders(): AiProviderInfo[] {
  return AI_PROVIDER_CATALOG;
}

export function getProviderInfo(id: AiProviderId | null): AiProviderInfo | null {
  if (id === null) {
    return null;
  }
  return AI_PROVIDER_CATALOG.find((info) => info.id === id) ?? null;
}