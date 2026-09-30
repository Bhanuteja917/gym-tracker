import { blockRange, buildGrid, dayKey, parseDayKey, rollingRange, type GridWeek } from './dot-grid';

// Dates are built with the local-time constructor so tests pass in any timezone.
const d = (y: number, m: number, day: number, h = 12) => new Date(y, m - 1, day, h);

const monthLabels = (weeks: GridWeek[]) =>
  weeks.map((w, i) => [i, w.month]).filter(([, m]) => m !== null);

describe('dayKey / parseDayKey', () => {
  it('is the local calendar date', () => {
    expect(dayKey(d(2026, 3, 7, 0))).toBe('2026-03-07');
    expect(dayKey(d(2026, 12, 31, 23).getTime())).toBe('2026-12-31');
  });

  it('parses back to local midnight', () => {
    const date = parseDayKey('2026-03-07')!;
    expect(dayKey(date)).toBe('2026-03-07');
    expect(date.getHours()).toBe(0);
  });

  it('rejects malformed or impossible dates', () => {
    expect(parseDayKey('2026-3-7')).toBeNull();
    expect(parseDayKey('2026-02-30')).toBeNull();
    expect(parseDayKey('')).toBeNull();
  });
});

describe('rollingRange + buildGrid', () => {
  // Thursday 1 Oct 2026
  const today = d(2026, 10, 1, 15);

  it('covers the requested number of Monday-to-Sunday weeks ending with this week', () => {
    const weeks = buildGrid(rollingRange(today, 13), today);
    expect(weeks).toHaveLength(13);
    for (const w of weeks) {
      expect(w.days).toHaveLength(7);
      expect(w.days[0].date.getDay()).toBe(1); // Monday
      expect(w.days[6].date.getDay()).toBe(0); // Sunday
    }
    expect(weeks[0].days[0].key).toBe('2026-07-06');
    expect(weeks[12].days[0].key).toBe('2026-09-28');
  });

  it('marks today and leaves the rest of this week out of range', () => {
    const [week] = buildGrid(rollingRange(today, 1), today);
    expect(week.days.map((x) => x.today)).toEqual([false, false, false, true, false, false, false]);
    expect(week.days.map((x) => x.inRange)).toEqual([true, true, true, true, false, false, false]);
  });

  it('treats Sunday as the end of its week', () => {
    const sunday = d(2026, 10, 4);
    const [week] = buildGrid(rollingRange(sunday, 1), sunday);
    expect(week.days[0].key).toBe('2026-09-28');
    expect(week.days[6].today).toBe(true);
    expect(week.days.every((x) => x.inRange)).toBe(true);
  });

  it('labels a week when its Monday is in a new month', () => {
    // Mondays: Jul 6, 13, 20, 27, Aug 3, 10, 17, 24, 31, Sep 7, 14, 21, 28.
    expect(monthLabels(buildGrid(rollingRange(today, 13), today))).toEqual([
      [0, 6], // Jul 6
      [4, 7], // Aug 3
      [9, 8], // Sep 7
    ]);
  });

  it('drops the first label when the next week starts a new month', () => {
    // Two weeks ending Wed 5 Aug 2026: Jul 27 week, then Aug 3 week.
    const day = d(2026, 8, 5);
    expect(buildGrid(rollingRange(day, 2), day).map((w) => w.month)).toEqual([null, 7]);
  });

  it('crosses daylight-saving changes without skipping or repeating days', () => {
    const day = d(2026, 11, 15);
    const keys = buildGrid(rollingRange(day, 52), day).flatMap((w) => w.days.map((x) => x.key));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toHaveLength(52 * 7);
  });
});

describe('blockRange', () => {
  const range = (y: number, m: number, day: number, months: number) => {
    const r = blockRange(d(y, m, day), months);
    return [dayKey(r.from), dayKey(r.to)];
  };

  it('runs the given number of calendar months from the start date', () => {
    expect(range(2027, 1, 1, 3)).toEqual(['2027-01-01', '2027-03-31']);
    expect(range(2027, 1, 15, 3)).toEqual(['2027-01-15', '2027-04-14']);
    expect(range(2027, 3, 1, 6)).toEqual(['2027-03-01', '2027-08-31']);
  });

  it('ends at the end of a shorter month', () => {
    expect(range(2027, 1, 31, 3)).toEqual(['2027-01-31', '2027-04-30']);
    expect(range(2026, 11, 30, 3)).toEqual(['2026-11-30', '2027-02-28']);
    expect(range(2027, 11, 30, 3)).toEqual(['2027-11-30', '2028-02-29']); // leap year
  });
});

describe('buildGrid over a start-date window', () => {
  // Fri 1 Jan 2027 → Wed 31 Mar 2027
  const range = blockRange(d(2027, 1, 1), 3);

  it('spans the weeks touching the window and flags only days inside it', () => {
    const weeks = buildGrid(range, d(2027, 2, 10));
    expect(weeks[0].days[0].key).toBe('2026-12-28');
    expect(weeks.at(-1)!.days[6].key).toBe('2027-04-04');
    const inside = weeks.flatMap((w) => w.days).filter((x) => x.inRange);
    expect(inside).toHaveLength(90);
    expect(inside[0].key).toBe('2027-01-01');
    expect(inside.at(-1)!.key).toBe('2027-03-31');
  });

  it('labels each column by the first in-window day, so the window starts on its own month', () => {
    const weeks = buildGrid(range, d(2027, 2, 10));
    expect(monthLabels(weeks)).toEqual([
      [0, 0], // week of Dec 28, labelled Jan
      [5, 1], // Feb 1
      [9, 2], // Mar 1
    ]);
  });

  it('marks days after today as future', () => {
    const days = buildGrid(range, d(2027, 2, 10)).flatMap((w) => w.days);
    expect(days.find((x) => x.key === '2027-02-10')).toMatchObject({ today: true, future: false });
    expect(days.find((x) => x.key === '2027-02-11')!.future).toBe(true);
    expect(days.find((x) => x.key === '2027-02-09')!.future).toBe(false);
  });

  it('handles a window entirely in the future or the past', () => {
    const before = buildGrid(range, d(2026, 10, 1)).flatMap((w) => w.days.filter((x) => x.inRange));
    expect(before.every((x) => x.future)).toBe(true);
    const after = buildGrid(range, d(2027, 6, 1)).flatMap((w) => w.days.filter((x) => x.inRange));
    expect(after.some((x) => x.future || x.today)).toBe(false);
  });
});
