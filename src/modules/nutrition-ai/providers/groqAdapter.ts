/**
 * INTEGRATION CONTRACT: internal (A4 nutrition-ai)
 * Purpose: the Groq adapter. Groq exposes an OpenAI-compatible chat-completions endpoint, so the
 *          image goes in as an `image_url` data URI and the reply is forced to JSON.
 * Canonical definition: SHARED_CONTRACT.md §7 (provider adapters)
 * Consumers: estimateService.ts
 * Contract status: APPROVED (internal symbol, no registry ID)
 *
 * UNVERIFIED_PROVIDER_API: the exact `reasoning_effort` field name and its accepted values change;
 * the lowest available value is requested here. See the docs URL in the catalog.
 */
import type { BuiltRequest, BuildRequestArgs, VisionProvider } from './types';

const BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';
/** CONTRACT §7: Groq accepts at most 3 images per request; this app sends exactly one. */
export const MAX_IMAGES = 3;

export const groqAdapter: VisionProvider = {
  id: 'groq',

  endpoint(): string {
    return BASE_URL;
  },

  buildRequest(args: BuildRequestArgs): BuiltRequest {
    return {
      url: BASE_URL,
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        // The key travels in a header only. It is never logged, never placed in a body or a URL.
        'Content-Type': 'application/json',
      },
      body: {
        model: args.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        reasoning_effort: 'low',
        messages: [
          { role: 'system', content: args.systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: args.userText },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${args.imageBase64Jpeg}` },
              },
            ],
          },
        ],
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
    const choices = root.choices;
    if (!Array.isArray(choices) || choices.length === 0) {
      return null;
    }
    const first = choices[0] as Record<string, unknown> | undefined;
    const message = first?.message as Record<string, unknown> | undefined;
    const content = message?.content;
    if (typeof content === 'string') {
      return content;
    }
    // Some OpenAI-compatible servers return content parts instead of a plain string.
    if (Array.isArray(content)) {
      const text = content
        .filter((part): part is Record<string, unknown> => typeof part === 'object' && part !== null)
        .map((part) => (typeof part.text === 'string' ? part.text : ''))
        .join('');
      return text.length > 0 ? text : null;
    }
    return null;
  },
};