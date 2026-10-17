/**
 * INTEGRATION CONTRACT: internal (A4 nutrition-ai)
 * Purpose: the one interface both provider adapters implement. Everything above this line works in
 *          provider-agnostic terms; model ids live here as data so a provider changing its model is a
 *          catalog edit, not a code change.
 * Canonical definition: SHARED_CONTRACT.md §7, AGENT_04_PROMPT.md §3
 * Consumers: groqAdapter.ts, geminiAdapter.ts, estimateService.ts
 * Contract status: APPROVED (internal symbol, no registry ID)
 */
import type { AiProviderId } from '@/shared/types/settings';

export interface BuildRequestArgs {
  model: string;
  apiKey: string;
  systemPrompt: string;
  userText: string;
  imageBase64Jpeg: string;
}

export interface BuiltRequest {
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

/** INTERNAL-WORKAROUND (A4): a provider adapter. Never logs anything it is given. */
export interface VisionProvider {
  id: AiProviderId;
  /** Base endpoint for this model, already including any provider-specific path. */
  endpoint(model: string): string;
  buildRequest(args: BuildRequestArgs): BuiltRequest;
  /** Pulls the model's text out of a decoded response, or null when the shape is unexpected. */
  extractText(json: unknown): string | null;
}