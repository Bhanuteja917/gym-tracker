import { describe, expect, it } from 'vitest';

import { exerciseInputSchema, setInputSchema } from './validation';

describe('setInputSchema', () => {
  it('parses form strings', () => {
    expect(
      setInputSchema.parse({ weight: '62,5', unit: 'kg', reps: '8', durationSec: '', rpe: '', notes: ' ' }),
    ).toEqual({
      weight: 62.5,
      unit: 'kg',
      reps: 8,
      durationSec: null,
      rpe: null,
      notes: null,
    });
  });

  it('treats a blank weight as bodyweight', () => {
    expect(
      setInputSchema.parse({ weight: '', unit: 'lb', reps: 10, durationSec: null, rpe: null, notes: null }).weight,
    ).toBeNull();
  });

  it('accepts a timed set without reps', () => {
    const plank = setInputSchema.parse({ weight: '', unit: 'kg', reps: '', durationSec: '1:30', rpe: '', notes: '' });
    expect(plank).toMatchObject({ reps: null, durationSec: 90 });
    expect(setInputSchema.parse({ weight: '', unit: 'kg', reps: '1', durationSec: '45', rpe: '', notes: '' }).durationSec).toBe(45);
  });

  it('rejects bad values with readable messages', () => {
    const bad = (input: object) =>
      setInputSchema.safeParse({ weight: '100', unit: 'lb', reps: '5', durationSec: '', rpe: '', notes: '', ...input })
        .error?.issues[0]?.message;
    expect(bad({ reps: '0' })).toBe('Reps must be at least 1');
    expect(bad({ reps: '' })).toBe('Enter reps or a time');
    expect(bad({ durationSec: '1:xx' })).toBe('Time must be seconds or m:ss');
    expect(bad({ reps: '2.5' })).toBe('Reps must be a whole number');
    expect(bad({ weight: 'abc' })).toBe('Weight must be a number');
    expect(bad({ weight: '-5' })).toBe('Weight can’t be negative');
    expect(bad({ rpe: '8.3' })).toBe('RPE must be in half steps');
    expect(bad({ unit: 'stone' })).toBeDefined();
  });
});

describe('exerciseInputSchema', () => {
  it('trims and nulls blanks', () => {
    expect(exerciseInputSchema.parse({ name: ' Squat ', muscleGroup: '', videoUrl: '' })).toEqual({
      name: 'Squat',
      muscleGroup: null,
      videoUrl: null,
    });
  });

  it('only accepts http(s) links', () => {
    expect(exerciseInputSchema.safeParse({ name: 'x', muscleGroup: null, videoUrl: 'javascript:alert(1)' }).success).toBe(false);
    expect(exerciseInputSchema.safeParse({ name: 'x', muscleGroup: null, videoUrl: 'https://youtu.be/abc' }).success).toBe(true);
  });
});
