import { convertWeight, formatWeight, parseOptionalCount, parseReps, parseRpe, parseWeight } from './units';

describe('convertWeight', () => {
  it('uses the exact lb/kg factor', () => {
    expect(convertWeight(100, 'lb', 'kg')).toBeCloseTo(45.359237, 9);
    expect(convertWeight(45.359237, 'kg', 'lb')).toBeCloseTo(100, 9);
  });

  it('returns the value unchanged for the same unit', () => {
    expect(convertWeight(135, 'lb', 'lb')).toBe(135);
  });
});

describe('formatWeight', () => {
  it('shows the entered value exactly in its own unit', () => {
    expect(formatWeight(135, 'lb')).toBe('135 lb');
    expect(formatWeight(62.5, 'kg')).toBe('62.5 kg');
  });

  it('converts and rounds to one decimal for another unit', () => {
    expect(formatWeight(135, 'lb', 'kg')).toBe('61.2 kg');
    expect(formatWeight(100, 'kg', 'lb')).toBe('220.5 lb');
    expect(formatWeight(20, 'kg', 'lb')).toBe('44.1 lb');
  });

  it('shows bodyweight for a null weight', () => {
    expect(formatWeight(null, 'lb', 'kg')).toBe('BW');
  });
});

describe('parseWeight', () => {
  it.each([
    ['135', 135],
    [' 62.5 ', 62.5],
    ['62,5', 62.5],
    ['.5', 0.5],
    ['0', 0],
  ])('parses %j', (input, expected) => {
    expect(parseWeight(input)).toEqual({ ok: true, value: expected });
  });

  it('treats empty as bodyweight', () => {
    expect(parseWeight('  ')).toEqual({ ok: true, value: null });
  });

  it.each(['abc', '-5', '1e3', '1.2.3', '5000'])('rejects %j', (input) => {
    expect(parseWeight(input).ok).toBe(false);
  });
});

describe('parseReps', () => {
  it('accepts whole numbers', () => {
    expect(parseReps('8')).toEqual({ ok: true, value: 8 });
  });

  it.each(['', '0', '2.5', '-1', 'x'])('rejects %j', (input) => {
    expect(parseReps(input).ok).toBe(false);
  });
});

describe('parseRpe', () => {
  it('is optional', () => {
    expect(parseRpe('')).toEqual({ ok: true, value: null });
  });

  it('accepts half steps from 1 to 10', () => {
    expect(parseRpe('8.5')).toEqual({ ok: true, value: 8.5 });
    expect(parseRpe('10')).toEqual({ ok: true, value: 10 });
  });

  it.each(['0', '11', '8.3', 'hard'])('rejects %j', (input) => {
    expect(parseRpe(input).ok).toBe(false);
  });
});

describe('parseOptionalCount', () => {
  it('allows empty and whole numbers from 1 up to the max', () => {
    expect(parseOptionalCount('', 'Sets')).toEqual({ ok: true, value: null });
    expect(parseOptionalCount(' 3 ', 'Sets')).toEqual({ ok: true, value: 3 });
    expect(parseOptionalCount('0', 'Sets')).toEqual({
      ok: false,
      error: 'Sets must be a whole number of at least 1',
    });
    expect(parseOptionalCount('2.5', 'Reps')).toEqual({
      ok: false,
      error: 'Reps must be a whole number of at least 1',
    });
    expect(parseOptionalCount('1001', 'Reps')).toEqual({ ok: false, error: 'Reps looks too large' });
    expect(parseOptionalCount('2200', 'Calories', 20000)).toEqual({ ok: true, value: 2200 });
  });
});
