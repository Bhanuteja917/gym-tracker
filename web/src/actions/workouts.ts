'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';

import { idSchema, notesSchema, setInputSchema } from '@/lib/validation';
import { requireUser } from '@/server/session';
import { addSet, deleteSet, updateSet } from '@/server/sets';
import {
  addExerciseToWorkout,
  deleteWorkout,
  finishWorkout,
  removeWorkoutExercise,
  resumeWorkout,
  startWorkout,
  updateWorkoutNotes,
} from '@/server/workouts';

import { attempt } from './result';

export async function startWorkoutAction(): Promise<never> {
  const user = await requireUser();
  const { id } = await startWorkout(user.id);
  redirect(`/workouts/${id}`);
}

export async function finishWorkoutAction(workoutId: unknown) {
  const user = await requireUser();
  const result = await attempt(() => finishWorkout(user.id, idSchema.parse(workoutId)));
  refresh();
  return result;
}

export async function resumeWorkoutAction(workoutId: unknown) {
  const user = await requireUser();
  const result = await attempt(() => resumeWorkout(user.id, idSchema.parse(workoutId)));
  refresh();
  return result;
}

export async function deleteWorkoutAction(workoutId: unknown) {
  const user = await requireUser();
  const result = await attempt(() => deleteWorkout(user.id, idSchema.parse(workoutId)));
  if (result.ok) redirect('/');
  return result;
}

export async function updateWorkoutNotesAction(workoutId: unknown, notes: unknown) {
  const user = await requireUser();
  const result = await attempt(() =>
    updateWorkoutNotes(user.id, idSchema.parse(workoutId), notesSchema.parse(notes)),
  );
  refresh();
  return result;
}

export async function addExerciseToWorkoutAction(workoutId: unknown, exerciseId: unknown) {
  const user = await requireUser();
  const result = await attempt(() =>
    addExerciseToWorkout(user.id, idSchema.parse(workoutId), idSchema.parse(exerciseId)),
  );
  refresh();
  return result;
}

export async function removeWorkoutExerciseAction(workoutExerciseId: unknown) {
  const user = await requireUser();
  const result = await attempt(async () => {
    await removeWorkoutExercise(user.id, idSchema.parse(workoutExerciseId));
  });
  refresh();
  return result;
}

export async function addSetAction(workoutExerciseId: unknown, input: unknown) {
  const user = await requireUser();
  const result = await attempt(async () => {
    await addSet(user.id, idSchema.parse(workoutExerciseId), setInputSchema.parse(input));
  });
  refresh();
  return result;
}

export async function updateSetAction(setId: unknown, input: unknown) {
  const user = await requireUser();
  const result = await attempt(async () => {
    await updateSet(user.id, idSchema.parse(setId), setInputSchema.parse(input));
  });
  refresh();
  return result;
}

export async function deleteSetAction(setId: unknown) {
  const user = await requireUser();
  const result = await attempt(async () => {
    await deleteSet(user.id, idSchema.parse(setId));
  });
  refresh();
  return result;
}
