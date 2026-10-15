import { ChevronRight, CloudOff } from 'lucide-react';

import { LocalTime } from '@/components/local-time';
import type { WorkoutSummary } from '@/local/queries';
import { AppLink } from '@/local/router';
import { formatDuration } from '@/lib/format';
import { bestSet } from '@/lib/progress';
import { formatSet } from '@/lib/units';

export function WorkoutSummaryCard({ workout }: { workout: WorkoutSummary }) {
  const setCount = workout.exercises.reduce((n, e) => n + e.sets.length, 0);
  return (
    <AppLink
      href={`/workout?id=${workout.id}`}
      className="bg-card active:bg-accent flex items-center gap-3 rounded-xl border p-4 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-semibold">
            <LocalTime date={workout.startedAt} format="day" />
          </span>
          <span className="text-muted-foreground text-xs">
            {workout.endedAt && formatDuration(workout.endedAt.getTime() - workout.startedAt.getTime())}
            {' · '}
            {setCount} {setCount === 1 ? 'set' : 'sets'}
          </span>
        </div>
        <ul className="text-muted-foreground mt-1 space-y-0.5 text-sm">
          {workout.exercises.slice(0, 4).map((e, i) => {
            const best = bestSet(e.sets);
            return (
              <li key={i} className="flex justify-between gap-2">
                <span className="truncate">
                  {e.sets.length} × {e.name}
                </span>
                {best && <span className="shrink-0 tabular-nums">{formatSet(best)}</span>}
              </li>
            );
          })}
          {workout.exercises.length > 4 && <li>+{workout.exercises.length - 4} more</li>}
        </ul>
        {workout.unsynced && <UnsyncedLabel className="mt-1.5" />}
      </div>
      <ChevronRight className="text-muted-foreground size-4 shrink-0" />
    </AppLink>
  );
}

/** Marks something that is saved on this device but hasn't reached the server yet. */
export function UnsyncedLabel({ className = '' }: { className?: string }) {
  return (
    <span className={`text-muted-foreground inline-flex items-center gap-1 text-xs ${className}`}>
      <CloudOff className="size-3" /> On this device only
    </span>
  );
}
