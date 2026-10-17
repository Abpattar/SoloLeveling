/** @jest-environment node */
import { assertAllowedUrl, ALLOWED_HOSTS } from '../httpClient';
import { groqAdapter } from '../providers/groqAdapter';
import { geminiAdapter } from '../providers/geminiAdapter';
import { buildSystemPrompt, buildUserText } from '../prompt';
import { AppError } from '@/shared/errors/AppError';

const args = {
  model: 'a-model',
  apiKey: 'sk-secret-value',
  systemPrompt: 'system',
  userText: 'user',
  imageBase64Jpeg: 'QUJD',
};

describe('host allow-list (SEC-05, GAT-018)', () => {
  it('allows exactly the two documented hosts', () => {
    expect(ALLOWED_HOSTS).toEqual(['api.groq.com', 'generativelanguage.googleapis.com']);
  });

  it('accepts https on an allowed host', () => {
    expect(() => assertAllowedUrl('https://api.groq.com/openai/v1/chat/completions')).not.toThrow();
    expect(() =>
      assertAllowedUrl('https://generativelanguage.googleapis.com/v1beta/models/m:generateContent'),
    ).not.toThrow();
  });

  it.each([
    'http://api.groq.com/v1',
    'https://evil.example.com/collect',
    'https://api.groq.com.evil.example.com/v1',
    'https://evil.example.com/?x=api.groq.com',
    'https://generativelanguage.googleapis.com.evil.com/',
    'file:///data/user/0/app/files/private-media/food/a.jpg',
    'not a url',
  ])('rejects %s', (url) => {
    expect(() => assertAllowedUrl(url)).toThrow(AppError);
  });

  it('never puts the rejected host in the error message', () => {
    try {
      assertAllowedUrl('https://evil.example.com/collect');
      throw new Error('should have thrown');
    } catch (e) {
      const error = e as AppError;
      expect(error.code).toBe('VALIDATION');
      expect(error.message).not.toContain('evil.example.com');
    }
  });
});

describe('groqAdapter (internal)', () => {
  it('targets the OpenAI-compatible chat completions endpoint', () => {
    expect(groqAdapter.endpoint('m')).toBe('https://api.groq.com/openai/v1/chat/completions');
  });

  it('sends the key in a header only', () => {
    const built = groqAdapter.buildRequest(args);
    expect(built.headers.Authorization).toBe('Bearer sk-secret-value');
    expect(JSON.stringify(built.body)).not.toContain('sk-secret-value');
    expect(built.url).not.toContain('sk-secret-value');
  });

  it('sends the model, the image as a data URI and JSON mode', () => {
    const built = groqAdapter.buildRequest(args);
    const body = built.body as {
      model: string;
      response_format: { type: string };
      messages: Array<{ role: string; content: unknown }>;
    };
    expect(body.model).toBe('a-model');
    expect(body.response_format.type).toBe('json_object');
    expect(JSON.stringify(body.messages)).toContain('data:image/jpeg;base64,QUJD');
    expect(JSON.stringify(body.messages)).toContain('system');
  });

  it('sends exactly one image', () => {
    const body = groqAdapter.buildRequest(args).body as {
      messages: Array<{ content: Array<{ type: string }> }>;
    };
    const userMessage = body.messages[1];
    const images = (userMessage?.content ?? []).filter((part) => part.type === 'image_url');
    expect(images).toHaveLength(1);
  });

  it('extracts the assistant text from a normal response', () => {
    expect(
      groqAdapter.extractText({
        choices: [{ message: { content: '{"totals":{"calories_kcal":10}}' } }],
      }),
    ).toBe('{"totals":{"calories_kcal":10}}');
  });

  it('joins content parts when the server returns an array', () => {
    expect(
      groqAdapter.extractText({
        choices: [{ message: { content: [{ type: 'text', text: 'a' }, { text: 'b' }] } }],
      }),
    ).toBe('ab');
  });

  it('returns null for an error payload or an unexpected shape', () => {
    expect(groqAdapter.extractText({ error: { message: 'bad key' } })).toBeNull();
    expect(groqAdapter.extractText({ choices: [] })).toBeNull();
    expect(groqAdapter.extractText(null)).toBeNull();
    expect(groqAdapter.extractText('text')).toBeNull();
  });
});

describe('geminiAdapter (internal)', () => {
  it('targets the generateContent endpoint on the allowed host', () => {
    expect(geminiAdapter.endpoint('gemini-2.5-flash-lite')).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent',
    );
    expect(() => assertAllowedUrl(geminiAdapter.endpoint('m'))).not.toThrow();
  });

  it('sends the key in a header only', () => {
    const built = geminiAdapter.buildRequest(args);
    expect(built.headers['x-goog-api-key']).toBe('sk-secret-value');
    expect(JSON.stringify(built.body)).not.toContain('sk-secret-value');
    expect(built.url).not.toContain('sk-secret-value');
  });

  it('sends the image inline and asks for JSON', () => {
    const body = geminiAdapter.buildRequest(args).body as {
      systemInstruction: unknown;
      contents: Array<{ role: string; parts: Array<Record<string, unknown>> }>;
      generationConfig: { responseMimeType: string };
    };
    expect(body.systemInstruction).toBeDefined();
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    const inline = body.contents[0]?.parts.find((p) => p.inlineData !== undefined);
    expect(inline?.inlineData).toEqual({ mimeType: 'image/jpeg', data: 'QUJD' });
  });

  it('extracts the text from the first candidate', () => {
    expect(
      geminiAdapter.extractText({
        candidates: [{ content: { parts: [{ text: '{"a":1}' }] } }],
      }),
    ).toBe('{"a":1}');
  });

  it('returns null for an error payload or an unexpected shape', () => {
    expect(geminiAdapter.extractText({ error: { code: 400 } })).toBeNull();
    expect(geminiAdapter.extractText({ candidates: [] })).toBeNull();
    expect(geminiAdapter.extractText({})).toBeNull();
  });
});

describe('prompt (REQ-FOOD-011)', () => {
  it('names common Indian and South Indian dishes', () => {
    const prompt = buildSystemPrompt().toLowerCase();
    for (const dish of [
      'idli',
      'dosa',
      'vada',
      'upma',
      'pongal',
      'sambar',
      'rasam',
      'biryani',
      'payasam',
      'chapati',
      'paratha',
      'curd rice',
    ]) {
      expect(prompt).toContain(dish);
    }
  });

  it('names household units', () => {
    const prompt = buildSystemPrompt().toLowerCase();
    for (const unit of ['katori', 'cup', 'piece', 'ladle', 'plate', 'glass', 'serving']) {
      expect(prompt).toContain(unit);
    }
  });

  it('asks for hidden fat to be counted', () => {
    const prompt = buildSystemPrompt().toLowerCase();
    expect(prompt).toMatch(/ghee/);
    expect(prompt).toMatch(/coconut/);
    expect(prompt).toMatch(/oil/);
    expect(prompt).toMatch(/sugar/);
  });

  it('demands the exact JSON schema and JSON only', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('"not_food"');
    expect(prompt).toContain('"calories_kcal"');
    expect(prompt).toContain('"clarification"');
    expect(prompt).toMatch(/ONE JSON object and nothing else/i);
  });

  it('allows at most one clarification and only when material', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toMatch(/AT MOST ONE clarification/i);
    expect(prompt).toMatch(/materially change/i);
  });

  it('forbids diet and medical advice', () => {
    const prompt = buildSystemPrompt().toLowerCase();
    expect(prompt).toMatch(/no diet advice/);
    expect(prompt).toMatch(/no health claims/);
  });

  it('includes the meal name, the note and the clarification answer when given', () => {
    const text = buildUserText({
      mealCategoryName: 'Lunch',
      userNote: 'had two rotis',
      clarification: { question: 'Ghee?', answer: 'Yes' },
    });
    expect(text).toContain('Lunch');
    expect(text).toContain('had two rotis');
    expect(text).toContain('Ghee?');
    expect(text).toContain('Yes');
  });

  it('omits what the caller did not supply', () => {
    const text = buildUserText({});
    expect(text).not.toContain('logged this as');
    expect(text).not.toContain("user's own note");
    expect(text).not.toContain('You asked');
  });
});