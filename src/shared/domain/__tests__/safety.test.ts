/** @jest-environment node */
import { evaluateSymptomReport } from '../safety';
import { SAFETY_ADVICE_MESSAGE, SAFETY_ADVICE_TITLE } from '../../constants/text';

describe('evaluateSymptomReport (API-SAFE-001, GAT-010)', () => {
  it('returns null with no flags, pain 7 and no user alert level', () => {
    expect(evaluateSymptomReport({ flags: [], painScore: 7 }, null)).toBeNull();
  });

  it('returns advice when any symptom flag is ticked', () => {
    const advice = evaluateSymptomReport({ flags: ['new_swelling'], painScore: null }, null);
    expect(advice).not.toBeNull();
    expect(advice?.level).toBe('stop_and_contact_clinician');
    expect(advice?.title).toBe(SAFETY_ADVICE_TITLE);
    expect(advice?.message).toBe(SAFETY_ADVICE_MESSAGE);
    expect(advice?.reasons).toEqual(['New or increased swelling']);
  });

  it('returns advice when pain reaches the user alert level', () => {
    const advice = evaluateSymptomReport({ flags: [], painScore: 7 }, 7);
    expect(advice).not.toBeNull();
    expect(advice?.reasons).toEqual(['Pain 7/10 (your alert level: 7)']);
  });

  it('returns null when pain is below the user alert level', () => {
    expect(evaluateSymptomReport({ flags: [], painScore: 6 }, 7)).toBeNull();
  });

  it('does nothing when an alert level is set but no pain score was given', () => {
    expect(evaluateSymptomReport({ flags: [], painScore: null }, 3)).toBeNull();
  });

  it('lists every triggered reason', () => {
    const advice = evaluateSymptomReport(
      { flags: ['giving_way', 'numbness_or_tingling'], painScore: 9 },
      8,
    );
    expect(advice?.reasons).toEqual([
      'Knee giving way',
      'Numbness or tingling',
      'Pain 9/10 (your alert level: 8)',
    ]);
  });
});