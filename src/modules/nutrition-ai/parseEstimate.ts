/**
 * INTEGRATION CONTRACT: internal (A4 nutrition-ai)
 * Purpose: defensive parsing of whatever the model replied. The model is not trusted: fences are
 *          stripped, prose around the JSON is tolerated, every number is clamped to the CONTRACT §7
 *          caps, and anything unusable becomes `PARSE_ERROR` rather than a wrong estimate.
 * Canonical definition: SHARED_CONTRACT.md §7 (model JSON schema + validation rules)
 * Consumers: estimateService.ts, parseEstimate.test.ts
 * Contract status: APPROVED (internal symbol, no registry ID)
 */
import { fail, ok } from '@/shared/errors/result';
import type { Confidence, NutritionValues } from '@/shared/types/food';
import type { ClarificationQuestion, EstimatedFoodItem } from '@/shared/types/nutritionAi';
import type { Result } from '@/shared/types/common';

const CAPS = {
  caloriesKcal: 5000,
  proteinGrams: 300,
  carbsGrams: 800,
  fatGrams: 400,
} as const;

const CONFIDENCES: Confidence[] = ['unknown', 'low', 'medium', 'high'];

export interface ParsedEstimate {
  notFood: boolean;
  description: string;
  portionText: string | null;
  items: EstimatedFoodItem[];
  nutrition: NutritionValues;
  confidence: Confidence;
  clarification: ClarificationQuestion | null;
}

/** Strips ``` fences and returns the first balanced JSON object in the text. */
export function extractJsonObject(text: string): string | null {
  if (typeof text !== 'string') {
    return null;
  }
  const withoutFences = text.replace(/```[a-zA-Z]*\s*([\s\S]*?)\s*```/g, '$1');
  const start = withoutFences.indexOf('{');
  if (start === -1) {
    return null;
  }
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < withoutFences.length; i += 1) {
    const char = withoutFences[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return withoutFences.slice(start, i + 1);
      }
    }
  }
  return null;
}

/**
 * A value above its cap becomes null and drags confidence down to `low`. `sawNumber` records that the
 * model actually produced a usable number, which is how a fully-capped response stays a valid (empty)
 * estimate instead of being mistaken for a provider failure.
 */
function clampNumber(
  value: unknown,
  cap: number,
  flag: { exceeded: boolean; sawNumber: boolean },
): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  flag.sawNumber = true;
  if (parsed > cap) {
    flag.exceeded = true;
    return null;
  }
  return parsed;
}

function parseItems(raw: unknown, flag: { exceeded: boolean; sawNumber: boolean }): EstimatedFoodItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: EstimatedFoodItem[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    const item = entry as Record<string, unknown>;
    const name = typeof item.name === 'string' && item.name.trim().length > 0 ? item.name.trim() : null;
    if (name === null) {
      continue;
    }
    out.push({
      name,
      portionText: typeof item.portion_text === 'string' && item.portion_text.length > 0 ? item.portion_text : null,
      caloriesKcal: clampNumber(item.calories_kcal, CAPS.caloriesKcal, flag),
      proteinGrams: clampNumber(item.protein_g, CAPS.proteinGrams, flag),
    });
  }
  return out;
}

function parseTotals(raw: unknown, flag: { exceeded: boolean; sawNumber: boolean }): NutritionValues {
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    caloriesKcal: clampNumber(source.calories_kcal, CAPS.caloriesKcal, flag),
    proteinGrams: clampNumber(source.protein_g, CAPS.proteinGrams, flag),
    carbsGrams: clampNumber(source.carbs_g, CAPS.carbsGrams, flag),
    fatGrams: clampNumber(source.fat_g, CAPS.fatGrams, flag),
  };
}

function parseClarification(raw: unknown): ClarificationQuestion | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const value = raw as Record<string, unknown>;
  const question = typeof value.question === 'string' ? value.question.trim() : '';
  const options = Array.isArray(value.options)
    ? value.options.filter((o): o is string => typeof o === 'string' && o.trim().length > 0)
    : [];
  const affects = value.affects === 'ingredient' ? 'ingredient' : 'portion';
  if (question.length === 0 || options.length < 2 || options.length > 4) {
    return null;
  }
  return { question, options, affects };
}

/** Parses and validates a model reply. Returns `Result`; never throws. */
export function parseEstimateJson(text: string): Result<ParsedEstimate> {
  const json = extractJsonObject(text);
  if (json === null) {
    return fail('PARSE_ERROR', 'The analysis service sent something unexpected. Your photo is saved; try again.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return fail('PARSE_ERROR', 'The analysis service sent something unexpected. Your photo is saved; try again.');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return fail('PARSE_ERROR', 'The analysis service sent something unexpected. Your photo is saved; try again.');
  }

  const root = parsed as Record<string, unknown>;
  const flag = { exceeded: false, sawNumber: false };
  const items = parseItems(root.items, flag);
  let nutrition = parseTotals(root.totals, flag);

  // Totals missing or all-null while items carry values: sum the items (CONTRACT §7).
  const totalsEmpty =
    nutrition.caloriesKcal === null &&
    nutrition.proteinGrams === null &&
    nutrition.carbsGrams === null &&
    nutrition.fatGrams === null;
  if (totalsEmpty && items.length > 0) {
    nutrition = {
      caloriesKcal:
        items.every((i) => i.caloriesKcal === null)
          ? null
          : items.reduce((sum, i) => sum + (i.caloriesKcal ?? 0), 0),
      proteinGrams:
        items.every((i) => i.proteinGrams === null)
          ? null
          : items.reduce((sum, i) => sum + (i.proteinGrams ?? 0), 0),
      carbsGrams: null,
      fatGrams: null,
    };
  }

  const rawConfidence = typeof root.confidence === 'string' ? root.confidence : 'unknown';
  let confidence: Confidence = CONFIDENCES.includes(rawConfidence as Confidence)
    ? (rawConfidence as Confidence)
    : 'unknown';
  if (flag.exceeded) {
    // CONTRACT §7: a value above its cap becomes null and confidence drops to low.
    confidence = 'low';
  }

  const notFood = root.not_food === true;

  if (notFood) {
    return ok({
      notFood: true,
      description: typeof root.description === 'string' ? root.description : '',
      portionText: null,
      items: [],
      nutrition: { caloriesKcal: null, proteinGrams: null, carbsGrams: null, fatGrams: null },
      confidence: 'unknown',
      clarification: null,
    });
  }

  if (!flag.sawNumber && items.length === 0) {
    // Nothing usable came back; treat it as a provider failure rather than storing zeros.
    return fail('PARSE_ERROR', 'The analysis service did not return an estimate. Your photo is saved; try again.');
  }

  return ok({
    notFood: false,
    description: typeof root.description === 'string' ? root.description : '',
    portionText:
      typeof root.portion_text === 'string' && root.portion_text.trim().length > 0
        ? root.portion_text.trim()
        : null,
    items,
    nutrition,
    confidence,
    clarification: parseClarification(root.clarification),
  });
}

/** INTERNAL-WORKAROUND (A4): exported so tests can assert the caps are the contract's caps. */
export const PARSE_CAPS = CAPS;

/** INTERNAL-WORKAROUND (A4): the user-safe message for a parse failure. */
export const PARSE_ERROR_MESSAGE =
  'The analysis service sent something unexpected. Your photo is saved; try again.';