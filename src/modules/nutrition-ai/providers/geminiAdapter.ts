/**
 * INTEGRATION CONTRACT: internal (A4 nutrition-ai)
 * Purpose: the Google Gemini adapter. The image is sent as inline data and the reply is forced to
 *          JSON through `responseMimeType`.
 * Canonical definition: SHARED_CONTRACT.md §7 (provider adapters)
 * Consumers: estimateService.ts
 * Contract status: APPROVED (internal symbol, no registry ID)
 *
 * UNVERIFIED_PROVIDER_API: the request shape and the free model id were NOT re-verified against
 * Google on 2026-10-13. Confirm at https://ai.google.dev/gemini-api/docs/models and
 * https://ai.google.dev/gemini-api/docs/image-understanding before relying on this adapter.
 */
import type { BuiltRequest, BuildRequestArgs, VisionProvider } from './types';

export const GEMINI_HOST = 'generativelanguage.googleapis.com';

export const geminiAdapter: VisionProvider = {
  id: 'gemini',

  endpoint(model: string): string {
    return `https://${GEMINI_HOST}/v1beta/models/${model}:generateContent`;
  },

  buildRequest(args: BuildRequestArgs): BuiltRequest {
    return {
      url: this.endpoint(args.model),
      headers: {
        // The key travels in a header only. Never logged, never placed in a body or a URL.
        'x-goog-api-key': args.apiKey,
        'Content-Type': 'application/json',
      },
      body: {
        systemInstruction: { parts: [{ text: args.systemPrompt }] },
        contents: [
          {
            role: 'user',
            parts: [
              { text: args.userText },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: args.imageBase64Jpeg,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
        },
      },
    };
  },

  extractText(json: unknown): string | null {
    if (typeof json !== 'object' || json === null) {
      return null;
    }
    const root = json as Record<string, unknown>;
    if (typeof root.error === 'object' && root.error !== null) {
      return null;
    }
    const candidates = root.candidates;
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return null;
    }
    const first = candidates[0] as Record<string, unknown> | undefined;
    const content = first?.content as Record<string, unknown> | undefined;
    const parts = content?.parts;
    if (!Array.isArray(parts)) {
      return null;
    }
    const text = parts
      .filter((part): part is Record<string, unknown> => typeof part === 'object' && part !== null)
      .map((part) => (typeof part.text === 'string' ? part.text : ''))
      .join('');
    return text.length > 0 ? text : null;
  },
};