import { describe, expect, it } from 'vitest';

import { bestSet, estimatedOneRepMax, progressSeries, volumeKg } from './progress';

describe('estimatedOneRepMax', () => {
  it('uses Epley and treats a single as its own max', () => {
    expect(estimatedOneRepMax({ weight: 100, unit: 'kg', reps: 1 })).toBe(100);
    expect(estimatedOneRepMax({ weight: 100, unit: 'kg', reps: 10 })).toBeCloseTo(133.33, 1);
  });

  it('is null for bodyweight and high-rep sets', () => {
    expect(estimatedOneRepMax({ weight: null, unit: 'kg', reps: 5 })).toBeNull();
    expect(estimatedOneRepMax({ weight: 50, unit: 'kg', reps: 20 })).toBeNull();
  });
});

describe('bestSet', () => {
  it('compares across units, then reps', () => {
    const sets = [
      { weight: 100, unit: 'kg' as const, reps: 5 },
      { weight: 225, unit: 'lb' as const, reps: 3 }, // 102 kg
      { weight: 225, unit: 'lb' as const, reps: 5 },
    ];
    expect(bestSet(sets)).toBe(sets[2]);
  });

  it('prefers any weighted set over bodyweight', () => {
    const sets = [
      { weight: null, unit: 'lb' as const, reps: 20 },
      { weight: 5, unit: 'lb' as const, reps: 1 },
    ];
    expect(bestSet(sets)).toBe(sets[1]);
    expect(bestSet([])).toBeUndefined();
  });
});

describe('volumeKg', () => {
  it('sums weight × reps in kg, ignoring bodyweight', () => {
    expect(
      volumeKg([
        { weight: 100, unit: 'kg', reps: 5 },
        { weight: null, unit: 'kg', reps: 10 },
      ]),
    ).toBe(500);
  });
});

describe('progressSeries', () => {
  const day = (d: number) => new Date(2026, 0, d);

  it('tracks the best e1RM per workout, oldest first, in the display unit', () => {
    const { metric, points } = progressSeries(
      [
        { startedAt: day(3), sets: [{ weight: 100, unit: 'kg', reps: 1 }] },
        { startedAt: day(1), sets: [{ weight: 200, unit: 'lb', reps: 1 }, { weight: 100, unit: 'lb', reps: 5 }] },
      ],
      'lb',
    );
    expect(metric).toBe('e1rm');
    expect(points.map((p) => p.date.getDate())).toEqual([1, 3]);
    expect(points[0]!.value).toBe(200);
    expect(points[1]!.value).toBeCloseTo(220.46, 1);
  });

  it('falls back to reps for bodyweight exercises', () => {
    const { metric, points } = progressSeries(
      [{ startedAt: day(1), sets: [{ weight: null, unit: 'lb', reps: 8 }, { weight: null, unit: 'lb', reps: 12 }] }],
      'lb',
    );
    expect(metric).toBe('reps');
    expect(points[0]!.value).toBe(12);
  });
});
