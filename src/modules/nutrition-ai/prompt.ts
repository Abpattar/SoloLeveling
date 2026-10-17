/**
 * INTEGRATION CONTRACT: internal (A4 nutrition-ai)
 * Purpose: the only prompt text in the app. It is deliberately narrow: describe what is visible,
 * estimate in household units, say "unknown" rather than guess, and give no diet or medical advice.
 * Canonical definition: SHARED_CONTRACT.md §7 (prompt requirements)
 * Consumers: estimateService.ts
 * Contract status: APPROVED (internal symbol, no registry ID)
 */

/** INTERNAL-WORKAROUND (A4): the exact JSON shape the model must reply with. */
export function buildSystemPrompt(): string {
  return [
    'You estimate nutrition for a personal tracking app. You are looking at one photo of a meal.',
    '',
    'Reply with ONE JSON object and nothing else. No markdown, no prose before or after.',
    'The JSON must have exactly this shape:',
    '{"not_food": false, "description": "string", "portion_text": "string|null",',
    ' "items": [{"name": "string", "portion_text": "string|null", "calories_kcal": 0, "protein_g": 0}],',
    ' "totals": {"calories_kcal": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0},',
    ' "confidence": "low|medium|high|unknown",',
    ' "clarification": {"question": "string", "options": ["string"], "affects": "portion|ingredient"}}',
    '',
    'Rules:',
    '- Estimate for the WHOLE portion that is visible in the photo.',
    '- Use household units and Indian household measures: bowl or katori, cup, piece, ladle, plate,',
    '  glass, handful, "1 serving". Give a number of such units, not grams only.',
    '- Recognise common Indian and South Indian dishes, including idli, dosa, vada, upma, pongal,',
    '  sambar, rasam, rice with curry or dal or poriyal or kootu, roti, chapati, paratha, biryani,',
    '  curd rice, payasam, upma, and common snacks and chaats, and regional meal servings.',
    '- Include hidden fat in your reasoning: cooking oil, ghee, coconut, sugar, and gravies count.',
    '- If you cannot tell, use null or "unknown". NEVER invent a precise number to look certain.',
    '- Set "not_food" to true and leave items and totals empty if the photo is not a meal.',
    '- Ask AT MOST ONE clarification question, and only when the answer would materially change the',
    '  calories or protein: either the portion size, or whether paneer, egg, meat or ghee is present.',
    '  Otherwise set "clarification" to null.',
    '- Give NO diet advice, no health claims, no recommendations, no ingredient substitutions.',
    '- Round calories to whole numbers and grams to one decimal place.',
  ].join('\n');
}

export interface UserTextArgs {
  mealCategoryName?: string;
  userNote?: string;
  clarification?: { question: string; answer: string };
}

export function buildUserText(args: UserTextArgs): string {
  const lines = ['Estimate the nutrition of the meal in this photo.'];
  if (args.mealCategoryName) {
    lines.push(`The user logged this as: ${args.mealCategoryName}.`);
  }
  if (args.userNote && args.userNote.trim().length > 0) {
    lines.push(`The user's own note about the meal: ${args.userNote.trim()}`);
  }
  if (args.clarification) {
    lines.push(`You asked: ${args.clarification.question}`);
    lines.push(`The user answered: ${args.clarification.answer}`);
    lines.push('Use that answer in this estimate.');
  }
  lines.push('Reply with the JSON object only.');
  return lines.join('\n');
}