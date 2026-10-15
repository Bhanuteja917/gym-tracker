'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { useNow } from '@/hooks/use-now';
import { blockRange, buildGrid, parseDayKey, rollingRange } from '@/lib/dot-grid';
import { ATTENDANCE_MONTHS, ATTENDANCE_WEEKS } from '@/lib/settings';
import { cn } from '@/lib/utils';
import { useLocalQuery } from '@/local/provider';
import { getGymDays, getSettings } from '@/local/queries';

const DAY_LABELS = ['M', '', 'W', '', 'F', '', ''];
/** Cell size cap, so 3 months on a wide screen doesn't turn into big blobs. */
const MAX_CELL_PX = 26;
const LABEL_PX = 16;

const plural = (n: number) => (n === 1 ? 'day' : 'days');
const shortDate = (date: Date, withYear: boolean) =>
  date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  });
const monthName = (month: number) => new Date(2000, month, 1).toLocaleDateString(undefined, { month: 'short' });

/**
 * GitHub-style grid of weeks with a filled dot for each day with a finished
 * workout. Covers the last 3 or 6 months, or a fixed window from the start
 * date chosen in Settings. Reads only the on-device database, so it works offline.
 */
export function AttendanceGrid() {
  const now = useNow(); // so "today" moves on at midnight
  const settings = useLocalQuery(getSettings, []);

  const start = settings?.attendanceStart ? parseDayKey(settings.attendanceStart) : null;
  const length = settings?.attendanceRange ?? '3m';
  const range = start ? blockRange(start, ATTENDANCE_MONTHS[length]) : rollingRange(now, ATTENDANCE_WEEKS[length]);
  const from = range.from;
  const to = new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate() + 1);
  const gymDays = useLocalQuery((db) => getGymDays(db, from, to), [from.getTime(), to.getTime()]);

  if (!settings || !gymDays) return <Skeleton className="h-44 w-full rounded-xl" />;

  const weeks = buildGrid(range, now);
  const count = gymDays.size;
  const totalDays = weeks.reduce((n, w) => n + w.days.filter((d) => d.inRange).length, 0);
  const title = start ? `${count} of ${totalDays} ${plural(totalDays)}` : `${count} ${plural(count)}`;
  const subtitle = start
    ? `${shortDate(range.from, range.from.getFullYear() !== range.to.getFullYear())} – ${shortDate(range.to, true)}`
    : `in the last ${ATTENDANCE_MONTHS[length]} months`;
  const columns = `${LABEL_PX}px repeat(${weeks.length}, minmax(0, 1fr))`;

  return (
    <section className="bg-card space-y-3 rounded-xl border p-4">
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="text-muted-foreground text-sm">{subtitle}</p>
      </div>

      <div
        role="img"
        aria-label={`Went to the gym on ${title}, ${subtitle}`}
        style={{ maxWidth: LABEL_PX + weeks.length * MAX_CELL_PX }}
      >
        <div
          className="text-muted-foreground mb-1 grid h-4 text-[11px] leading-4"
          style={{ gridTemplateColumns: columns }}
        >
          {weeks.map((w, i) =>
            w.month === null ? null : (
              <span key={w.days[0].key} className="whitespace-nowrap" style={{ gridColumn: i + 2, gridRow: 1 }}>
                {monthName(w.month)}
              </span>
            ),
          )}
        </div>
        {/* One grid for labels and dots, filled column by column, so every row shares one height. */}
        <div className="grid grid-flow-col grid-rows-7" style={{ gridTemplateColumns: columns }}>
          {DAY_LABELS.map((label, i) => (
            <span key={i} className="text-muted-foreground flex items-center text-[10px]">
              {label}
            </span>
          ))}
          {weeks.flatMap((w) =>
            w.days.map((day) => (
              <div key={day.key} className="flex aspect-square items-center justify-center">
                {day.inRange && (
                  <div
                    data-day={day.key}
                    data-gym={gymDays.has(day.key) || undefined}
                    className={cn(
                      'size-[70%] rounded-full',
                      gymDays.has(day.key) ? 'bg-emerald-500' : 'bg-muted-foreground/20',
                      day.future && 'opacity-40',
                      day.today && 'ring-foreground ring-[1.5px]',
                    )}
                  />
                )}
              </div>
            )),
          )}
        </div>
      </div>
    </section>
  );
}
