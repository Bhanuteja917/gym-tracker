'use server';

import { importExerciseLibrary } from '@/server/exercise-library';
import { getCurrentUser } from '@/server/session';

import { attempt, type ActionResult } from './result';

/** Adds the built-in exercise library to the user's exercises, skipping names they already have. */
export async function importExerciseLibraryAction() {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Sign in again to add exercises' } satisfies ActionResult;
  return attempt(() => importExerciseLibrary(user.id));
}
