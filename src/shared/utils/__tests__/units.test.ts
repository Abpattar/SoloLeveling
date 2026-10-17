/** @jest-environment node */
import {
  cmToIn,
  formatLength,
  formatWeight,
  inToCm,
  kgToLb,
  lbToKg,
  toKg,
  weightUnitLabel,
} from '../units';

describe('weight conversion', () => {
  it('round trips kg -> lb -> kg', () => {
    expect(kgToLb(70)).toBeCloseTo(154.32, 2);
    expect(lbToKg(kgToLb(70))).toBeCloseTo(70, 9);
    expect(lbToKg(154.323583526)).toBeCloseTo(70, 9);
  });

  it('round trips cm -> in -> cm', () => {
    expect(cmToIn(2.54)).toBeCloseTo(1, 9);
    expect(inToCm(cmToIn(170))).toBeCloseTo(170, 9);
  });
});

describe('toKg', () => {
  it('accepts kg and lb, case-insensitively with whitespace', () => {
    expect(toKg(70, 'kg')).toBe(70);
    expect(toKg(70, ' KG ')).toBe(70);
    expect(toKg(154.323583526, 'lb')).toBeCloseTo(70, 6);
    expect(toKg(154.323583526, 'LB')).toBeCloseTo(70, 6);
  });

  it('returns null for any unknown unit instead of guessing', () => {
    expect(toKg(70, 'g')).toBeNull();
    expect(toKg(70, 'cm')).toBeNull();
    expect(toKg(70, '')).toBeNull();
  });
});

describe('formatting', () => {
  it('formats weight with one decimal and the right unit', () => {
    expect(formatWeight(72.5, 'metric')).toBe('72.5 kg');
    expect(formatWeight(72.5, 'imperial')).toBe('159.8 lb');
  });

  it('formats length in the user unit system', () => {
    expect(formatLength(170, 'metric')).toBe('170 cm');
    expect(formatLength(170, 'imperial')).toBe('5 ft 7 in');
    expect(formatLength(152.4, 'imperial')).toBe('5 ft 0 in');
  });

  it('labels the weight unit', () => {
    expect(weightUnitLabel('metric')).toBe('kg');
    expect(weightUnitLabel('imperial')).toBe('lb');
  });
});