/** A local calendar date as `YYYY-MM-DD`. */
export type DayKey = string;

export function dayKey(time: Date | number): DayKey {
  const date = typeof time === 'number' ? new Date(time) : time;
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/** Local midnight of a `YYYY-MM-DD` key, or null if it isn't a real date. */
export function parseDayKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return dayKey(date) === key ? date : null;
}

/** An inclusive span of local days. */
export interface DayRange {
  from: Date;
  to: Date;
}

export interface GridDay {
  key: DayKey;
  /** Local midnight. */
  date: Date;
  inRange: boolean;
  today: boolean;
  future: boolean;
}

export interface GridWeek {
  /** Monday first, Sunday last. */
  days: GridDay[];
  /** Month (0–11) to label this column with, or null. */
  month: number | null;
}

// Building dates from their parts (not by adding milliseconds) keeps
// daylight-saving changes from skipping or repeating a day.
const midnight = (date: Date, addDays = 0) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + addDays);

const daysSinceMonday = (date: Date) => (date.getDay() + 6) % 7;

/** The last `weekCount` Monday-to-Sunday weeks, ending today. */
export function rollingRange(today: Date, weekCount: number): DayRange {
  return {
    from: midnight(today, -daysSinceMonday(today) - (weekCount - 1) * 7),
    to: midnight(today),
  };
}

/**
 * `months` calendar months starting on `start`: Jan 15 + 3 runs to Apr 14.
 * When the matching day doesn't exist, the window ends with the shorter month
 * (Nov 30 + 3 runs to the end of February).
 */
export function blockRange(start: Date, months: number): DayRange {
  const y = start.getFullYear();
  const m = start.getMonth() + months;
  const dayBefore = new Date(y, m, start.getDate() - 1);
  const lastOfMonth = new Date(y, m + 1, 0);
  return {
    from: midnight(start),
    to: dayBefore < lastOfMonth ? dayBefore : lastOfMonth,
  };
}

/**
 * Monday-to-Sunday weeks covering `range`, oldest first. Each week is labelled
 * with the month of its first in-range day when that differs from the previous
 * week's (so labels mark where a month starts); the first week is labelled too
 * unless the second one already is.
 */
export function buildGrid(range: DayRange, today: Date): GridWeek[] {
  const todayKey = dayKey(today);
  const fromKey = dayKey(range.from);
  const toKey = dayKey(range.to);
  const firstMonday = midnight(range.from, -daysSinceMonday(range.from));

  const weeks: GridWeek[] = [];
  for (let w = 0; ; w++) {
    const days: GridDay[] = [];
    for (let i = 0; i < 7; i++) {
      const date = midnight(firstMonday, w * 7 + i);
      const key = dayKey(date);
      days.push({
        key,
        date,
        inRange: key >= fromKey && key <= toKey,
        today: key === todayKey,
        future: key > todayKey,
      });
    }
    const month = (days.find((x) => x.inRange) ?? days[0]).date.getMonth();
    const previous = weeks.at(-1);
    const previousMonth = previous ? (previous.days.find((x) => x.inRange) ?? previous.days[0]).date.getMonth() : null;
    weeks.push({ days, month: month !== previousMonth ? month : null });
    if (days[6].key >= toKey) break;
  }

  if (weeks.length > 1 && weeks[1].month !== null) weeks[0].month = null;
  return weeks;
}
