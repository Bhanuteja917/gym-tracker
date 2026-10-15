'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { exerciseInputSchema, idSchema } from '@/lib/validation';
import {
  createExercise,
  deleteExercise,
  setExerciseArchived,
  updateExercise,
} from '@/server/exercises';
import { requireUser } from '@/server/session';
import { addExerciseToWorkout } from '@/server/workouts';

import { attempt } from './result';

/** Creates an exercise; with a workout id, also adds it to that workout. */
export async function createExerciseAction(input: unknown, addToWorkoutId?: unknown) {
  const user = await requireUser();
  const result = await attempt(async () => {
    const exercise = await createExercise(user.id, exerciseInputSchema.parse(input));
    if (addToWorkoutId !== undefined) {
      await addExerciseToWorkout(user.id, idSchema.parse(addToWorkoutId), exercise.id);
    }
    return { id: exercise.id };
  });
  refresh();
  return result;
}

export async function updateExerciseAction(id: unknown, input: unknown) {
  const user = await requireUser();
  const result = await attempt(() =>
    updateExercise(user.id, idSchema.parse(id), exerciseInputSchema.parse(input)),
  );
  refresh();
  return result;
}

export async function setExerciseArchivedAction(id: unknown, archived: unknown) {
  const user = await requireUser();
  const result = await attempt(() =>
    setExerciseArchived(user.id, idSchema.parse(id), z.boolean().parse(archived)),
  );
  refresh();
  return result;
}

export async function deleteExerciseAction(id: unknown) {
  const user = await requireUser();
  const result = await attempt(() => deleteExercise(user.id, idSchema.parse(id)));
  if (result.ok) redirect('/exercises');
  return result;
}
