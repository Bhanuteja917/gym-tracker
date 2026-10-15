import { describe, expect, it } from 'vitest';

import { BACK, FRONT } from '@/components/muscle-figure/body-paths';

import { MUSCLES, isMuscleId, musclesFor, sideFor } from './muscles';

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

describe('sideFor', () => {
  it('picks the side that shows most of the muscles', () => {
    expect(sideFor(['hamstrings'])).toBe('back');
    expect(sideFor(['quads', 'glutes'])).toBe('front');
    expect(sideFor(['lats', 'biceps', 'traps-middle'])).toBe('back');
    expect(sideFor([])).toBe('front');
  });

  it('only picks a side the muscles are drawn on', () => {
    for (const { id } of MUSCLES) expect(sideFor([id]) === 'back' ? BACK[id] : FRONT[id], id).toBeDefined();
  });
});
