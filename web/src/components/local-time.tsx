'use client';

import { useHydrated } from '@/hooks/use-hydrated';
import { formatDay, formatShortDate, formatTime } from '@/lib/format';

const FORMATS = {
  day: formatDay,
  time: formatTime,
  dayTime: (d: Date) => `${formatDay(d)} · ${formatTime(d)}`,
  short: formatShortDate,
};

/**
 * A date in the viewer's time zone. The server doesn't know it, so the text is
 * filled in after hydration.
 */
export function LocalTime({ date, format = 'day' }: { date: Date; format?: keyof typeof FORMATS }) {
  const hydrated = useHydrated();
  return (
    <time dateTime={date.toISOString()} suppressHydrationWarning>
      {hydrated ? FORMATS[format](date) : ' '}
    </time>
  );
}
