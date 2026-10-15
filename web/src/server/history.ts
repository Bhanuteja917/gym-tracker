import 'server-only';

import { prisma } from './db';
import type { SetRow } from './workouts';

export type ExerciseSession = { workoutId: string; startedAt: Date; sets: SetRow[] };

const setSelect = {
  id: true,
  position: true,
  weight: true,
  unit: true,
  reps: true,
  rpe: true,
  notes: true,
  completedAt: true,
} as const;

/** Every workout that logged sets for this exercise, newest first. */
export async function getExerciseHistory(
  userId: string,
  exerciseId: string,
  { excludeWorkoutId, limit }: { excludeWorkoutId?: string; limit?: number } = {},
): Promise<ExerciseSession[]> {
  const rows = await prisma.workoutExercise.findMany({
    where: {
      exerciseId,
      workout: { userId, ...(excludeWorkoutId ? { id: { not: excludeWorkoutId } } : {}) },
      sets: { some: {} },
    },
    orderBy: [{ workout: { startedAt: 'desc' } }, { position: 'asc' }],
    select: {
      workoutId: true,
      workout: { select: { startedAt: true } },
      sets: { orderBy: { position: 'asc' }, select: setSelect },
    },
  });

  // The same exercise can appear twice in one workout; merge those.
  const result: ExerciseSession[] = [];
  for (const row of rows) {
    const current = result.at(-1);
    if (current?.workoutId === row.workoutId) {
      current.sets.push(...row.sets);
    } else {
      if (limit !== undefined && result.length >= limit) break;
      result.push({ workoutId: row.workoutId, startedAt: row.workout.startedAt, sets: row.sets });
    }
  }
  return result;
}

/** "Last time" for each exercise: the most recent other workout's sets, keyed by exercise id. */
export async function getLastPerformances(
  userId: string,
  exerciseIds: string[],
  excludeWorkoutId: string,
): Promise<Record<string, ExerciseSession>> {
  const entries = await Promise.all(
    [...new Set(exerciseIds)].map(
      async (id) =>
        [id, (await getExerciseHistory(userId, id, { excludeWorkoutId, limit: 1 }))[0]] as const,
    ),
  );
  return Object.fromEntries(entries.filter((e): e is [string, ExerciseSession] => !!e[1]));
}
