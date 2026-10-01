import {
  calorieStatus,
  formatKcal,
  macroLines,
  macroSummary,
  parseCalories,
  parseMacro,
} from './nutrition';

describe('parseCalories', () => {
  it('requires a whole number from 0 to 20,000', () => {
    expect(parseCalories(' 650 ')).toEqual({ ok: true, value: 650 });
    expect(parseCalories('0')).toEqual({ ok: true, value: 0 });
    expect(parseCalories('')).toEqual({ ok: false, error: 'Calories are required' });
    expect(parseCalories('12.5')).toEqual({ ok: false, error: 'Calories must be a whole number' });
    expect(parseCalories('-5')).toEqual({ ok: false, error: 'Calories must be a whole number' });
    expect(parseCalories('20001')).toEqual({ ok: false, error: 'Calories look too large' });
  });
});

describe('parseMacro', () => {
  it('is optional and accepts decimals', () => {
    expect(parseMacro('', 'Protein')).toEqual({ ok: true, value: null });
    expect(parseMacro('30', 'Protein')).toEqual({ ok: true, value: 30 });
    expect(parseMacro('12,5', 'Fat')).toEqual({ ok: true, value: 12.5 });
    expect(parseMacro('abc', 'Carbs')).toEqual({ ok: false, error: 'Carbs must be a number' });
    expect(parseMacro('2001', 'Carbs')).toEqual({ ok: false, error: 'Carbs looks too large' });
  });
});

describe('formatting', () => {
  it('adds thousands separators to kcal', () => {
    expect(formatKcal(950)).toBe('950');
    expect(formatKcal(1450)).toBe('1,450');
    expect(formatKcal(12345.6)).toBe('12,346');
  });

  it('summarises only the macros that are set', () => {
    expect(macroSummary({ protein: 30, carbs: 45.56, fat: null })).toBe('P 30 · C 45.6');
    expect(macroSummary({ protein: null, carbs: null, fat: null })).toBeUndefined();
  });

  it('lists macros that have a target or a logged value', () => {
    expect(
      macroLines(
        { protein: 120, carbs: null, fat: null },
        { calories: 2200, protein: 150, carbs: null, fat: 70 },
      ),
    ).toEqual(['Protein 120 / 150 g', 'Fat 0 / 70 g']);
    expect(
      macroLines(
        { protein: null, carbs: 80, fat: null },
        { calories: null, protein: null, carbs: null, fat: null },
      ),
    ).toEqual(['Carbs 80 g']);
  });

  it('describes calories left or over', () => {
    expect(calorieStatus(1450, 2200)).toBe('750 kcal left');
    expect(calorieStatus(2320, 2200)).toBe('120 kcal over');
    expect(calorieStatus(1450, null)).toBeNull();
  });
});
