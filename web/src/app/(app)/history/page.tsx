import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { ListSkeleton } from '@/components/list-skeleton';
import { PageHeader } from '@/components/page-header';
import { WorkoutSummaryCard } from '@/components/workout-summary-card';
import { Button } from '@/components/ui/button';
import { requireUser } from '@/server/session';
import { listWorkouts } from '@/server/workouts';

export const metadata: Metadata = { title: 'History' };

export default function HistoryPage({ searchParams }: PageProps<'/history'>) {
  return (
    <>
      <PageHeader title="History" />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <WorkoutList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function WorkoutList({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ cursor }, user] = await Promise.all([searchParams, requireUser()]);
  const { workouts, nextCursor } = await listWorkouts(user.id, {
    limit: 20,
    cursor: typeof cursor === 'string' ? cursor : undefined,
  });

  if (workouts.length === 0) {
    return <p className="text-muted-foreground text-sm">Finished workouts show up here.</p>;
  }
  return (
    <div className="space-y-3">
      {workouts.map((w) => (
        <WorkoutSummaryCard key={w.id} workout={w} />
      ))}
      {(nextCursor || cursor) && (
        <div className="flex justify-between pt-2">
          {cursor ? (
            <Button asChild variant="ghost">
              <Link href="/history">Newest</Link>
            </Button>
          ) : (
            <span />
          )}
          {nextCursor && (
            <Button asChild variant="outline">
              <Link href={`/history?cursor=${nextCursor}`}>Older</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
