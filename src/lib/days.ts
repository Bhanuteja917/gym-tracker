import { dayKey, parseDayKey, type DayKey } from '@/lib/dot-grid';

/** ISO weekday: Monday = 1 … Sunday = 7. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];

export const WEEKDAY_NAMES: Record<Weekday, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
};

export function isWeekday(value: number): value is Weekday {
  return Number.isInteger(value) && value >= 1 && value <= 7;
}

export function weekdayOf(date: Date): Weekday {
  return (((date.getDay() + 6) % 7) + 1) as Weekday;
}

/** The day `n` days after `key` (negative for earlier). Throws on an invalid key. */
export function shiftDayKey(key: DayKey, n: number): DayKey {
  const date = parseDayKey(key);
  if (!date) throw new Error(`Invalid day: ${key}`);
  // Built from parts so daylight-saving changes can't skip or repeat a day.
  return dayKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() + n));
}

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Today", "Yesterday", "Tomorrow", or e.g. "Mon, Sep 28" (with the year when it isn't this year). */
export function formatDayKey(key: DayKey, today: Date = new Date()): string {
  const todayKey = dayKey(today);
  if (key === todayKey) return 'Today';
  if (key === shiftDayKey(todayKey, -1)) return 'Yesterday';
  if (key === shiftDayKey(todayKey, 1)) return 'Tomorrow';
  const date = parseDayKey(key);
  if (!date) return key;
  const label = `${SHORT_DAYS[date.getDay()]}, ${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}`;
  return date.getFullYear() === today.getFullYear() ? label : `${label}, ${date.getFullYear()}`;
}
