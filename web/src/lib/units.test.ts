import { describe, expect, it } from 'vitest';

import { convertWeight, formatNumber, formatSet, formatWeight } from './units';

describe('units', () => {
  it('converts both ways', () => {
    expect(convertWeight(100, 'kg', 'kg')).toBe(100);
    expect(convertWeight(100, 'lb', 'kg')).toBeCloseTo(45.359237);
    expect(convertWeight(convertWeight(225, 'lb', 'kg'), 'kg', 'lb')).toBeCloseTo(225);
  });

  it('formats numbers without trailing zeros', () => {
    expect(formatNumber(135)).toBe('135');
    expect(formatNumber(61.235)).toBe('61.2');
    expect(formatNumber(61.25, 2)).toBe('61.25');
  });

  it('shows weights exactly in their own unit and rounded when converted', () => {
    expect(formatWeight(62.5, 'kg')).toBe('62.5 kg');
    expect(formatWeight(135, 'lb', 'kg')).toBe('61.2 kg');
    expect(formatWeight(null, 'lb')).toBe('BW');
  });

  it('formats a set', () => {
    expect(formatSet({ weight: 135, unit: 'lb', reps: 8 })).toBe('135 lb × 8');
    expect(formatSet({ weight: null, unit: 'lb', reps: 12, rpe: 8.5 })).toBe('BW × 12 @8.5');
  });
});
