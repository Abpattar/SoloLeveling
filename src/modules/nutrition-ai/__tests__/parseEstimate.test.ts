/** @jest-environment node */
import { extractJsonObject, parseEstimateJson, PARSE_CAPS } from '../parseEstimate';

function ok(result: ReturnType<typeof parseEstimateJson>) {
  if (!result.ok) {
    throw new Error(`expected success, got ${result.error.code}`);
  }
  return result.value;
}

describe('extractJsonObject (internal)', () => {
  it('reads a plain object', () => {
    expect(extractJsonObject('{"a":1}')).toBe('{"a":1}');
  });

  it('reads an object inside ``` fences', () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(extractJsonObject('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('reads an object that follows prose', () => {
    expect(extractJsonObject('Sure! Here you go:\n{"a":1}\nHope that helps.')).toBe('{"a":1}');
  });

  it('is not confused by braces inside strings', () => {
    expect(extractJsonObject('{"note":"a } b","n":1}')).toBe('{"note":"a } b","n":1}');
  });

  it('is not confused by escaped quotes', () => {
    expect(extractJsonObject('{"note":"a \\" } \\" b","n":1}')).toBe(
      '{"note":"a \\" } \\" b","n":1}',
    );
  });

  it('returns null when there is no object at all', () => {
    expect(extractJsonObject('no json here')).toBeNull();
    expect(extractJsonObject('')).toBeNull();
    expect(extractJsonObject('{"unclosed": 1')).toBeNull();
  });
});

describe('parseEstimateJson (internal)', () => {
  it('maps a complete valid response', () => {
    const value = ok(
      parseEstimateJson(
        JSON.stringify({
          not_food: false,
          description: 'Dosa with chutney',
          portion_text: '1 dosa',
          items: [{ name: 'Dosa', portion_text: '1', calories_kcal: 250, protein_g: 6 }],
          totals: { calories_kcal: 280, protein_g: 7, carbs_g: 40, fat_g: 9 },
          confidence: 'medium',
          clarification: {
            question: 'How much oil?',
            options: ['Little', 'A lot'],
            affects: 'portion',
          },
        }),
      ),
    );
    expect(value.notFood).toBe(false);
    expect(value.description).toBe('Dosa with chutney');
    expect(value.portionText).toBe('1 dosa');
    expect(value.items).toHaveLength(1);
    expect(value.nutrition).toEqual({
      caloriesKcal: 280,
      proteinGrams: 7,
      carbsGrams: 40,
      fatGrams: 9,
    });
    expect(value.confidence).toBe('medium');
    expect(value.clarification?.question).toBe('How much oil?');
  });

  it('accepts a fenced response with prose around it', () => {
    const value = ok(
      parseEstimateJson(
        '```json\n{"totals":{"calories_kcal":100},"confidence":"low"}\n```\nThat is my estimate.',
      ),
    );
    expect(value.nutrition.caloriesKcal).toBe(100);
  });

  it('summarises totals from the items when totals are missing', () => {
    const value = ok(
      parseEstimateJson(
        JSON.stringify({
          items: [
            { name: 'Idli', calories_kcal: 80, protein_g: 4 },
            { name: 'Sambar', calories_kcal: 120, protein_g: 6 },
          ],
        }),
      ),
    );
    expect(value.nutrition.caloriesKcal).toBe(200);
    expect(value.nutrition.proteinGrams).toBe(10);
  });

  it('keeps a macro null when no item supplied it', () => {
    const value = ok(
      parseEstimateJson(
        JSON.stringify({
          items: [{ name: 'Idli', calories_kcal: 80 }],
          totals: { calories_kcal: 80 },
        }),
      ),
    );
    expect(value.nutrition.carbsGrams).toBeNull();
    expect(value.nutrition.fatGrams).toBeNull();
  });

  it('nulls a value above its cap and drops confidence to low', () => {
    const value = ok(
      parseEstimateJson(
        JSON.stringify({
          totals: {
            calories_kcal: PARSE_CAPS.caloriesKcal + 1,
            protein_g: 10,
            carbs_g: 20,
            fat_g: 5,
          },
          confidence: 'high',
        }),
      ),
    );
    expect(value.nutrition.caloriesKcal).toBeNull();
    expect(value.confidence).toBe('low');
  });

  it('applies every CONTRACT §7 cap', () => {
    const value = ok(
      parseEstimateJson(
        JSON.stringify({
          totals: {
            calories_kcal: 6000,
            protein_g: 400,
            carbs_g: 900,
            fat_g: 500,
          },
        }),
      ),
    );
    expect(value.nutrition).toEqual({
      caloriesKcal: null,
      proteinGrams: null,
      carbsGrams: null,
      fatGrams: null,
    });
  });

  it('rejects negative, NaN and non-numeric values rather than storing them', () => {
    const value = ok(
      parseEstimateJson(
        JSON.stringify({
          totals: { calories_kcal: -50, protein_g: 'abc', carbs_g: 20, fat_g: 5 },
        }),
      ),
    );
    expect(value.nutrition.caloriesKcal).toBeNull();
    expect(value.nutrition.proteinGrams).toBeNull();
    expect(value.nutrition.carbsGrams).toBe(20);
  });

  it('keeps a clarification only with a question and 2-4 options', () => {
    const withGood = ok(
      parseEstimateJson(
        JSON.stringify({
          totals: { calories_kcal: 100 },
          clarification: { question: 'Egg?', options: ['Yes', 'No'], affects: 'ingredient' },
        }),
      ),
    );
    expect(withGood.clarification?.affects).toBe('ingredient');

    const oneOption = ok(
      parseEstimateJson(
        JSON.stringify({
          totals: { calories_kcal: 100 },
          clarification: { question: 'Egg?', options: ['Yes'], affects: 'ingredient' },
        }),
      ),
    );
    expect(oneOption.clarification).toBeNull();

    const noQuestion = ok(
      parseEstimateJson(
        JSON.stringify({
          totals: { calories_kcal: 100 },
          clarification: { question: '  ', options: ['Yes', 'No'] },
        }),
      ),
    );
    expect(noQuestion.clarification).toBeNull();

    const tooMany = ok(
      parseEstimateJson(
        JSON.stringify({
          totals: { calories_kcal: 100 },
          clarification: { question: 'Which?', options: ['a', 'b', 'c', 'd', 'e'] },
        }),
      ),
    );
    expect(tooMany.clarification).toBeNull();
  });

  it('recognises not_food and empties everything', () => {
    const value = ok(
      parseEstimateJson(
        JSON.stringify({
          not_food: true,
          description: 'A shoe',
          items: [{ name: 'shoe', calories_kcal: 500 }],
          totals: { calories_kcal: 500, protein_g: 10, carbs_g: 10, fat_g: 10 },
          confidence: 'high',
        }),
      ),
    );
    expect(value.notFood).toBe(true);
    expect(value.items).toEqual([]);
    expect(value.nutrition.caloriesKcal).toBeNull();
    expect(value.confidence).toBe('unknown');
  });

  it('ignores unknown fields instead of failing', () => {
    const value = ok(
      parseEstimateJson(
        JSON.stringify({ totals: { calories_kcal: 100 }, something_new: { a: 1 }, confidence: 'high' }),
      ),
    );
    expect(value.nutrition.caloriesKcal).toBe(100);
    expect(value.confidence).toBe('high');
  });

  it('falls back to unknown for an unrecognised confidence', () => {
    const value = ok(
      parseEstimateJson(JSON.stringify({ totals: { calories_kcal: 100 }, confidence: 'very high' })),
    );
    expect(value.confidence).toBe('unknown');
  });

  it('drops items without a usable name', () => {
    const value = ok(
      parseEstimateJson(
        JSON.stringify({
          items: [{ calories_kcal: 10 }, { name: 'Idli', calories_kcal: 80 }, 'nonsense'],
          totals: { calories_kcal: 80 },
        }),
      ),
    );
    expect(value.items).toHaveLength(1);
    expect(value.items[0]?.name).toBe('Idli');
  });

  it.each([
    ['plain garbage', 'not json'],
    ['a JSON array', '[1,2,3]'],
    ['a JSON scalar', '42'],
    ['broken JSON', '{"a": }'],
    ['nothing usable', '{}'],
    ['an empty items list with no totals', '{"items": []}'],
  ])('returns PARSE_ERROR for %s', (_name, text) => {
    const result = parseEstimateJson(text);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PARSE_ERROR');
      expect(result.error.message).toMatch(/photo is saved/i);
    }
  });
});