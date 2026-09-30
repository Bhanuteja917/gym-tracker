import { and, asc, desc, eq, ne } from 'drizzle-orm';

import { sessionExercises, sessions, setEntries, type SetEntry } from '@/db/schema';
import type { DB } from '@/db/types';
import { toKg } from '@/lib/units';

export type ExerciseSessionHistory = {
  sessionId: number;
  startedAt: number;
  sets: SetEntry[];
};

/** Every workout that logged sets for this exercise, newest first. */
export function getExerciseHistory(
  db: DB,
  exerciseId: number,
  { excludeSessionId, limit }: { excludeSessionId?: number; limit?: number } = {},
): ExerciseSessionHistory[] {
  const conditions = [eq(sessionExercises.exerciseId, exerciseId)];
  if (excludeSessionId !== undefined) conditions.push(ne(sessions.id, excludeSessionId));

  const rows = db
    .select({ sessionId: sessions.id, startedAt: sessions.startedAt, set: setEntries })
    .from(setEntries)
    .innerJoin(sessionExercises, eq(setEntries.sessionExerciseId, sessionExercises.id))
    .innerJoin(sessions, eq(sessionExercises.sessionId, sessions.id))
    .where(and(...conditions))
    .orderBy(desc(sessions.startedAt), asc(sessionExercises.position), asc(setEntries.position))
    .all();

  const result: ExerciseSessionHistory[] = [];
  for (const row of rows) {
    const current = result.at(-1);
    if (current?.sessionId === row.sessionId) {
      current.sets.push(row.set);
    } else {
      if (limit !== undefined && result.length >= limit) break;
      result.push({ sessionId: row.sessionId, startedAt: row.startedAt, sets: [row.set] });
    }
  }
  return result;
}

/** The most recent other workout's sets for this exercise ("last time"). */
export function getLastPerformance(
  db: DB,
  exerciseId: number,
  excludeSessionId?: number,
): ExerciseSessionHistory | undefined {
  return getExerciseHistory(db, exerciseId, { excludeSessionId, limit: 1 })[0];
}

/**
 * Best set: the heaviest weight (compared in kg so lb and kg sets mix),
 * then the most reps. Bodyweight sets only win when there are no weighted sets.
 */
export function bestSet<T extends Pick<SetEntry, 'weight' | 'unit' | 'reps'>>(
  sets: readonly T[],
): T | undefined {
  let best: T | undefined;
  for (const set of sets) {
    if (!best) {
      best = set;
      continue;
    }
    const a = set.weight === null ? -1 : toKg(set.weight, set.unit);
    const b = best.weight === null ? -1 : toKg(best.weight, best.unit);
    if (a > b + 1e-9 || (Math.abs(a - b) <= 1e-9 && set.reps > best.reps)) best = set;
  }
  return best;
}
