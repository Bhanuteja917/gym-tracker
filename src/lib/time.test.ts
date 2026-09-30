import { formatDuration, restTimes } from './time';

describe('formatDuration', () => {
  it('formats minutes and seconds', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(105_000)).toBe('1:45');
  });

  it('adds hours when needed', () => {
    expect(formatDuration(3_725_000)).toBe('1:02:05');
  });
});

describe('restTimes', () => {
  it('is the gap since the previous set, with none before the first', () => {
    expect(restTimes([1000, 91_000, 211_000])).toEqual([null, 90_000, 120_000]);
    expect(restTimes([])).toEqual([]);
  });
});
