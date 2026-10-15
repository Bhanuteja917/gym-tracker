'use client';

import { ListSkeleton } from '@/components/list-skeleton';
import { PageHeader } from '@/components/page-header';
import { WorkoutEditor } from '@/components/workout/workout-editor';
import { useLocalQuery } from '@/local/provider';
import { getDefaultUnit, getLastPerformances, getWorkoutDetail, listExercises } from '@/local/queries';
import { AppLink } from '@/local/router';

export function WorkoutScreen({ id }: { id: string }) {
  const workout = useLocalQuery((db) => getWorkoutDetail(db, id), [id]);
  const exerciseIds = workout?.exercises.map((e) => e.exercise.id) ?? [];
  const lastTime = useLocalQuery((db) => getLastPerformances(db, exerciseIds, id), [id, exerciseIds.join()]);
  const defaultUnit = useLocalQuery(getDefaultUnit, []);
  const exercises = useLocalQuery(listExercises, []);

  if (workout === null) {
    return (
      <>
        <PageHeader title="Workout not found" />
        <p className="text-muted-foreground text-sm">
          It may have been deleted on another device.{' '}
          <AppLink href="/" className="underline">
            Back to Workout
          </AppLink>
        </p>
      </>
    );
  }
  if (!workout || !lastTime || !defaultUnit || !exercises) return <ListSkeleton rows={2} className="mt-16 h-48" />;
  return (
    <WorkoutEditor
      workout={workout}
      lastTime={lastTime}
      defaultUnit={defaultUnit}
      exercises={exercises.filter((e) => !e.archived)}
    />
  );
}
