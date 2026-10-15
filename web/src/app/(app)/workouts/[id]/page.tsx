import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { ListSkeleton } from '@/components/list-skeleton';
import { WorkoutEditor } from '@/components/workout/workout-editor';
import { DomainError } from '@/server/errors';
import { listExercises } from '@/server/exercises';
import { getLastPerformances } from '@/server/history';
import { requireUser } from '@/server/session';
import { getDefaultUnit } from '@/server/settings';
import { getWorkout } from '@/server/workouts';

export const metadata: Metadata = { title: 'Workout' };

export default function WorkoutPage({ params }: PageProps<'/workouts/[id]'>) {
  return (
    <Suspense fallback={<ListSkeleton rows={2} className="h-48" />}>
      <Workout params={params} />
    </Suspense>
  );
}

async function Workout({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([params, requireUser()]);
  const workout = await getWorkout(user.id, id).catch((error) => {
    if (error instanceof DomainError && error.code === 'NOT_FOUND') notFound();
    throw error;
  });
  const [lastTime, defaultUnit, exercises] = await Promise.all([
    getLastPerformances(
      user.id,
      workout.exercises.map((e) => e.exercise.id),
      workout.id,
    ),
    getDefaultUnit(user.id),
    listExercises(user.id),
  ]);

  return <WorkoutEditor workout={workout} lastTime={lastTime} defaultUnit={defaultUnit} exercises={exercises} />;
}
