import 'server-only';

import { randomUUID } from 'node:crypto';

import library from './exercise-library.json';
import { withUserLock } from './sync';

type LibraryEntry = { name: string; muscleGroup: string | null };

/** Exercises in the built-in library (regenerate with scripts/build-exercise-library.mjs). */
export const LIBRARY: readonly LibraryEntry[] = library.exercises;

/** Entries an earlier version of the library imported differently (`before`), and what they are now. */
export const CORRECTED: readonly { before: LibraryEntry; after: LibraryEntry }[] = library.corrected;

/** Entries an earlier version imported that the library no longer has (duplicates, foam rolling, drills). */
export const DROPPED: readonly LibraryEntry[] = library.dropped;

export type LibraryResult = { created: number; skipped: number; corrected: number; hidden: number };

const key = (name: string) => name.toLowerCase();

/**
 * Adds every library exercise the user doesn't have yet (matched by name,
 * ignoring case, including archived ones), so running it again adds nothing.
 *
 * It also brings exercises imported from an earlier version of the library up
 * to date, but only ones still exactly as imported (same name and muscle
 * group): corrected names and muscle groups are applied (a new name already
 * in use is left alone), and entries since dropped are archived if they were
 * never logged. Devices download the changes on their next sync.
 */
export async function importExerciseLibrary(userId: string): Promise<LibraryResult> {
  return withUserLock(
    userId,
    async (tx) => {
      const existing = await tx.exercise.findMany({
        where: { userId, deletedAt: null },
        select: {
          id: true,
          name: true,
          muscleGroup: true,
          archived: true,
          _count: { select: { workoutExercises: true } },
        },
      });
      const byName = new Map(existing.map((e) => [key(e.name), e]));
      const untouched = (entry: LibraryEntry) => {
        const e = byName.get(key(entry.name));
        return e && e.name === entry.name && e.muscleGroup === entry.muscleGroup ? e : undefined;
      };

      let corrected = 0;
      for (const { before, after } of CORRECTED) {
        const e = untouched(before);
        if (!e) continue;
        const renamed = key(after.name) !== key(before.name);
        const name = renamed && byName.has(key(after.name)) ? e.name : after.name;
        if (name === e.name && after.muscleGroup === e.muscleGroup) continue;
        await tx.exercise.update({ where: { id: e.id }, data: { name, muscleGroup: after.muscleGroup } });
        byName.delete(key(e.name));
        byName.set(key(name), { ...e, name, muscleGroup: after.muscleGroup });
        corrected++;
      }

      let hidden = 0;
      for (const entry of DROPPED) {
        const e = untouched(entry);
        if (!e || e.archived || e._count.workoutExercises > 0) continue;
        await tx.exercise.update({ where: { id: e.id }, data: { archived: true } });
        hidden++;
      }

      const createdAt = new Date();
      const data = LIBRARY.filter((e) => !byName.has(key(e.name))).map((e) => ({
        id: randomUUID(),
        userId,
        name: e.name,
        muscleGroup: e.muscleGroup,
        createdAt,
      }));
      await tx.exercise.createMany({ data });
      return { created: data.length, skipped: LIBRARY.length - data.length, corrected, hidden };
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
}
