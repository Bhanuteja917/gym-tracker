import 'server-only';

import { randomUUID } from 'node:crypto';

import library from './exercise-library.json';
import { withUserLock } from './sync';

/** Exercises in the built-in library (regenerate with scripts/build-exercise-library.mjs). */
export const LIBRARY: readonly { name: string; muscleGroup: string | null }[] = library.exercises;

export type LibraryResult = { created: number; skipped: number };

/**
 * Adds every library exercise the user doesn't have yet (matched by name,
 * ignoring case, including archived ones), so running it again adds nothing.
 * Devices download the new exercises on their next sync.
 */
export async function importExerciseLibrary(userId: string): Promise<LibraryResult> {
  return withUserLock(
    userId,
    async (tx) => {
      const existing = await tx.exercise.findMany({ where: { userId, deletedAt: null }, select: { name: true } });
      const taken = new Set(existing.map((e) => e.name.toLowerCase()));
      const createdAt = new Date();
      const data = LIBRARY.filter((e) => !taken.has(e.name.toLowerCase())).map((e) => ({
        id: randomUUID(),
        userId,
        name: e.name,
        muscleGroup: e.muscleGroup,
        createdAt,
      }));
      await tx.exercise.createMany({ data });
      return { created: data.length, skipped: LIBRARY.length - data.length };
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
}
