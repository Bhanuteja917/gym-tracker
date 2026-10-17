'use client';

import { Play } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';

import { AttendanceGrid } from '@/components/attendance-grid';
import { ListSkeleton } from '@/components/list-skeleton';
import { LocalTime } from '@/components/local-time';
import { PageHeader } from '@/components/page-header';
import { WorkoutSummaryCard } from '@/components/workout-summary-card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { startWorkout } from '@/local/mutations';
import { useLocal, useLocalQuery } from '@/local/provider';
import { getInProgress, getSettings, listExercises, listFinishedWorkouts } from '@/local/queries';
import { AppLink, navigate } from '@/local/router';
import { dayName, formatTarget, WEEKDAY_LABELS, weekdayOf } from '@/lib/plan';

export function HomeScreen() {
  const { mutate } = useLocal();
  const inProgress = useLocalQuery(getInProgress, []);
  const recent = useLocalQuery((db) => listFinishedWorkouts(db, 3), []);
  const settings = useLocalQuery(getSettings, []);
  const exercises = useLocalQuery(listExercises, []);
  const [pending, startTransition] = useTransition();

  const weekday = weekdayOf(new Date());
  const today = settings?.weeklyPlan[weekday];
  const byId = new Map((exercises ?? []).map((e) => [e.id, e]));
  const planned = today?.items.filter((i) => byId.has(i.exerciseId)) ?? [];
  const hasPlan = settings ? Object.values(settings.weeklyPlan).some((d) => d.items.length > 0) : false;

  function start(exerciseIds: string[] = []) {
    startTransition(async () => {
      const result = await mutate((db) => startWorkout(db, new Date(), exerciseIds));
      if (result.ok) navigate(`/workout?id=${result.data}`);
      else toast.error(result.error);
    });
  }

  return (
    <>
      <PageHeader title="Workout" />
      {inProgress === undefined || recent === undefined || settings === undefined || exercises === undefined ? (
        <ListSkeleton rows={3} />
      ) : (
        <div className="space-y-6">
          <AttendanceGrid />
          {inProgress.length > 0 ? (
            inProgress.map((w) => (
              <div key={w.id} className="bg-primary text-primary-foreground rounded-2xl p-5">
                <p className="text-sm opacity-80">
                  In progress since <LocalTime date={w.startedAt} format={inProgress.length > 1 ? 'dayTime' : 'time'} />
                </p>
                <Button asChild size="lg" variant="secondary" className="mt-3 h-12 w-full text-base">
                  <AppLink href={`/workout?id=${w.id}`}>Continue workout</AppLink>
                </Button>
              </div>
            ))
          ) : planned.length > 0 ? (
            <div className="bg-card space-y-3 rounded-2xl border p-4">
              <div className="flex items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Today · {WEEKDAY_LABELS[weekday]}
                  </p>
                  <h2 className="truncate text-lg font-semibold">{dayName(today!)}</h2>
                </div>
                <AppLink href={`/plan/day?day=${weekday}`} className="text-muted-foreground shrink-0 text-sm">
                  Edit
                </AppLink>
              </div>
              <ol className="text-sm">
                {planned.map((item, i) => (
                  <li key={`${item.exerciseId}-${i}`} className="flex justify-between gap-3 py-0.5">
                    <span className="truncate">{byId.get(item.exerciseId)!.name}</span>
                    <span className="text-muted-foreground shrink-0 tabular-nums">{formatTarget(item)}</span>
                  </li>
                ))}
              </ol>
              <Button
                size="lg"
                className="h-12 w-full text-base"
                onClick={() => start(planned.map((i) => i.exerciseId))}
                disabled={pending}
              >
                {pending ? <Spinner /> : <Play className="size-5" />} Start {today!.title || 'today’s workout'}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => start()} disabled={pending}>
                Start an empty workout instead
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Button
                size="lg"
                className="h-14 w-full rounded-2xl text-base"
                onClick={() => start()}
                disabled={pending}
              >
                {pending ? <Spinner /> : <Play className="size-5" />} Start workout
              </Button>
              <p className="text-muted-foreground text-center text-sm">
                {hasPlan ? (
                  'Today is a rest day in your plan.'
                ) : (
                  <>
                    <AppLink href="/plan" className="underline">
                      Plan your week
                    </AppLink>{' '}
                    to start each day with its exercises.
                  </>
                )}
              </p>
            </div>
          )}
          {inProgress.length > 1 && (
            <p className="text-muted-foreground text-sm">
              Workouts were started on more than one device. Finish the one you’re not using.
            </p>
          )}

          <section className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">Recent</h2>
              {recent.total > 0 && (
                <AppLink href="/history" className="text-muted-foreground text-sm">
                  See all
                </AppLink>
              )}
            </div>
            {recent.total === 0 ? (
              <p className="text-muted-foreground text-sm">No workouts yet. Start one, or import a backup in Settings.</p>
            ) : (
              recent.workouts.map((w) => <WorkoutSummaryCard key={w.id} workout={w} />)
            )}
          </section>
        </div>
      )}
    </>
  );
}
