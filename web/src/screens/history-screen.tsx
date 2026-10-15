'use client';

import { useState } from 'react';

import { ListSkeleton } from '@/components/list-skeleton';
import { PageHeader } from '@/components/page-header';
import { WorkoutSummaryCard } from '@/components/workout-summary-card';
import { Button } from '@/components/ui/button';
import { useLocalQuery } from '@/local/provider';
import { listFinishedWorkouts } from '@/local/queries';

const PAGE = 20;

export function HistoryScreen() {
  const [limit, setLimit] = useState(PAGE);
  const data = useLocalQuery((db) => listFinishedWorkouts(db, limit), [limit]);

  return (
    <>
      <PageHeader title="History" />
      {data === undefined ? (
        <ListSkeleton rows={4} />
      ) : data.total === 0 ? (
        <p className="text-muted-foreground text-sm">Finished workouts show up here.</p>
      ) : (
        <div className="space-y-3">
          {data.workouts.map((w) => (
            <WorkoutSummaryCard key={w.id} workout={w} />
          ))}
          {data.total > data.workouts.length && (
            <Button variant="outline" className="w-full" onClick={() => setLimit((n) => n + PAGE)}>
              Show older ({data.total - data.workouts.length} more)
            </Button>
          )}
        </div>
      )}
    </>
  );
}
