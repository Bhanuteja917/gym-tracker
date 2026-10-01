import { formatDayKey, isWeekday, shiftDayKey, weekdayOf } from './days';

describe('weekdayOf', () => {
  it('numbers Monday 1 through Sunday 7', () => {
    expect(weekdayOf(new Date(2026, 8, 28))).toBe(1); // Mon 28 Sep 2026
    expect(weekdayOf(new Date(2026, 9, 1, 0, 30))).toBe(4); // Thu
    expect(weekdayOf(new Date(2026, 9, 4, 23, 59))).toBe(7); // Sun
  });
});

describe('isWeekday', () => {
  it('accepts only whole numbers 1–7', () => {
    expect(isWeekday(1)).toBe(true);
    expect(isWeekday(7)).toBe(true);
    expect(isWeekday(0)).toBe(false);
    expect(isWeekday(8)).toBe(false);
    expect(isWeekday(1.5)).toBe(false);
    expect(isWeekday(NaN)).toBe(false);
  });
});

describe('shiftDayKey', () => {
  it('rolls over months, years and leap days', () => {
    expect(shiftDayKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDayKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDayKey('2028-03-01', -1)).toBe('2028-02-29');
    expect(shiftDayKey('2026-10-01', 0)).toBe('2026-10-01');
  });

  it('throws on an invalid key', () => {
    expect(() => shiftDayKey('nope', 1)).toThrow('Invalid day');
  });
});

describe('formatDayKey', () => {
  const today = new Date(2026, 9, 1, 9, 0);

  it('names nearby days', () => {
    expect(formatDayKey('2026-10-01', today)).toBe('Today');
    expect(formatDayKey('2026-09-30', today)).toBe('Yesterday');
    expect(formatDayKey('2026-10-02', today)).toBe('Tomorrow');
  });

  it('shows weekday, month and day, adding the year when it differs', () => {
    expect(formatDayKey('2026-09-28', today)).toBe('Mon, Sep 28');
    expect(formatDayKey('2025-12-25', today)).toBe('Thu, Dec 25, 2025');
  });
});
