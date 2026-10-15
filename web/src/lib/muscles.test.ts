import { describe, expect, it } from 'vitest';

import { MUSCLES, isMuscleId, musclesFor } from './muscles';

describe('musclesFor', () => {
  it('expands broad groups and ignores case', () => {
    expect(musclesFor('LEGS')).toEqual(['glutes', 'quads', 'hamstrings', 'calves']);
    expect(musclesFor(' core ')).toEqual(['abdominals', 'obliques']);
    expect(musclesFor('Full body')).toHaveLength(MUSCLES.length);
  });

  it('resolves single muscles and synonyms', () => {
    expect(musclesFor('Calves')).toEqual(['calves']);
    expect(musclesFor('Quadriceps')).toEqual(['quads']);
    expect(musclesFor('Traps (mid-back)')).toEqual(['traps-middle']);
  });

  it('combines lists without duplicates, in body-map order', () => {
    expect(musclesFor('Hamstrings, Calves & glutes')).toEqual(['glutes', 'hamstrings', 'calves']);
    expect(musclesFor('Legs and Glutes')).toEqual(['glutes', 'quads', 'hamstrings', 'calves']);
  });

  it('returns nothing for unknown or empty groups', () => {
    expect(musclesFor('Cardio')).toEqual([]);
    expect(musclesFor(null)).toEqual([]);
    expect(musclesFor('')).toEqual([]);
  });
});

describe('isMuscleId', () => {
  it('accepts only known ids', () => {
    expect(isMuscleId('calves')).toBe(true);
    expect(isMuscleId('Calves')).toBe(false);
    expect(isMuscleId(null)).toBe(false);
  });
});
