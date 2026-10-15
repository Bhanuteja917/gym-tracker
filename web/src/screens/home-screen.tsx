'use client';

import { Play } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';

import { ListSkeleton } from '@/components/list-skeleton';
import { LocalTime } from '@/components/local-time';
import { PageHeader } from '@/components/page-header';
import { WorkoutSummaryCard } from '@/components/workout-summary-card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { startWorkout } from '@/local/mutations';
import { useLocal, useLocalQuery } from '@/local/provider';
import { getInProgress, listFinishedWorkouts } from '@/local/queries';
import { AppLink, navigate } from '@/local/router';

export function HomeScreen() {
  const { mutate } = useLocal();
  const inProgress = useLocalQuery(getInProgress, []);
  const recent = useLocalQuery((db) => listFinishedWorkouts(db, 3), []);
  const [pending, startTransition] = useTransition();

  function start() {
    startTransition(async () => {
      const result = await mutate((db) => startWorkout(db));
      if (result.ok) navigate(`/workout?id=${result.data}`);
      else toast.error(result.error);
    });
  }

  return (
    <>
      <PageHeader title="Workout" />
      {inProgress === undefined || recent === undefined ? (
        <ListSkeleton rows={3} />
      ) : (
        <div className="space-y-6">
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
          ) : (
            <Button size="lg" className="h-14 w-full rounded-2xl text-base" onClick={start} disabled={pending}>
              {pending ? <Spinner /> : <Play className="size-5" />} Start workout
            </Button>
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
