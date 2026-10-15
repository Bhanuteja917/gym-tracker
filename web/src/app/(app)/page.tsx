import { Play } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

import { startWorkoutAction } from '@/actions/workouts';
import { ListSkeleton } from '@/components/list-skeleton';
import { LocalTime } from '@/components/local-time';
import { PageHeader } from '@/components/page-header';
import { SubmitButton } from '@/components/submit-button';
import { WorkoutSummaryCard } from '@/components/workout-summary-card';
import { Button } from '@/components/ui/button';
import { requireUser } from '@/server/session';
import { getActiveWorkout, listWorkouts } from '@/server/workouts';

export default function WorkoutHomePage() {
  return (
    <>
      <PageHeader title="Workout" />
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <WorkoutHome />
      </Suspense>
    </>
  );
}

async function WorkoutHome() {
  const user = await requireUser();
  const [active, { workouts: recent }] = await Promise.all([
    getActiveWorkout(user.id),
    listWorkouts(user.id, { limit: 3 }),
  ]);

  return (
    <div className="space-y-6">
      {active ? (
        <div className="bg-primary text-primary-foreground rounded-2xl p-5">
          <p className="text-sm opacity-80">
            In progress since <LocalTime date={active.startedAt} format="time" />
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-3 h-12 w-full text-base">
            <Link href={`/workouts/${active.id}`}>Continue workout</Link>
          </Button>
        </div>
      ) : (
        <form action={startWorkoutAction}>
          <SubmitButton size="lg" className="h-14 w-full rounded-2xl text-base">
            <Play className="size-5" /> Start workout
          </SubmitButton>
        </form>
      )}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Recent</h2>
          {recent.length > 0 && (
            <Link href="/history" className="text-muted-foreground text-sm">
              See all
            </Link>
          )}
        </div>
        {recent.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No workouts yet. Start one, or import a backup in Settings.
          </p>
        ) : (
          recent.map((w) => <WorkoutSummaryCard key={w.id} workout={w} />)
        )}
      </section>
    </div>
  );
}
