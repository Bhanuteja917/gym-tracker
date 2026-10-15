import { describe, expect, it } from 'vitest';

import { suggestNextSet } from './suggest';

const s = (weight: number | null, reps: number) => ({ weight, unit: 'kg' as const, reps });

describe('suggestNextSet', () => {
  it('repeats the previous set in this workout', () => {
    expect(suggestNextSet([s(60, 8), s(65, 6)], [s(100, 1)], 'lb')).toEqual(s(65, 6));
  });

  it('falls back to the same set from last time, then its last set', () => {
    const last = [s(60, 8), s(62.5, 6)];
    expect(suggestNextSet([], last, 'lb')).toEqual(s(60, 8));
    expect(suggestNextSet([], [s(60, 8)], 'lb')).toEqual(s(60, 8));
  });

  it('is blank in the default unit with no history', () => {
    expect(suggestNextSet([], undefined, 'lb')).toEqual({ weight: null, unit: 'lb', reps: null });
  });
});
