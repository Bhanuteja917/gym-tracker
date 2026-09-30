import { asc, count, eq, sql } from 'drizzle-orm';

import { exercises, sessionExercises, type Exercise } from '@/db/schema';
import type { DB } from '@/db/types';

export class DuplicateExerciseError extends Error {
  constructor(public readonly existing: Exercise) {
    super(`"${existing.name}" already exists`);
  }
}

export function listExercises(db: DB, { includeArchived = false } = {}): Exercise[] {
  const query = db.select().from(exercises);
  return (includeArchived ? query : query.where(eq(exercises.archived, false)))
    .orderBy(asc(sql`lower(${exercises.name})`))
    .all();
}

export function getExercise(db: DB, id: number): Exercise | undefined {
  return db.select().from(exercises).where(eq(exercises.id, id)).get();
}

function findByName(db: DB, name: string): Exercise | undefined {
  return db
    .select()
    .from(exercises)
    .where(sql`lower(${exercises.name}) = lower(${name})`)
    .get();
}

function normalizeName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (trimmed === '') throw new Error('Exercise name is required');
  return trimmed;
}

/**
 * Creates an exercise. If an archived exercise has the same name it is
 * restored instead; an active one with the same name is a duplicate.
 */
export function createExercise(db: DB, name: string, category: string | null = null): Exercise {
  const normalized = normalizeName(name);
  const existing = findByName(db, normalized);
  if (existing) {
    if (!existing.archived) throw new DuplicateExerciseError(existing);
    return db
      .update(exercises)
      .set({ archived: false })
      .where(eq(exercises.id, existing.id))
      .returning()
      .get();
  }
  return db
    .insert(exercises)
    .values({ name: normalized, category, createdAt: Date.now() })
    .returning()
    .get();
}

export function renameExercise(db: DB, id: number, name: string): Exercise {
  const normalized = normalizeName(name);
  const existing = findByName(db, normalized);
  if (existing && existing.id !== id) throw new DuplicateExerciseError(existing);
  return db
    .update(exercises)
    .set({ name: normalized })
    .where(eq(exercises.id, id))
    .returning()
    .get();
}

export function setExerciseArchived(db: DB, id: number, archived: boolean): void {
  db.update(exercises).set({ archived }).where(eq(exercises.id, id)).run();
}

/**
 * Deletes an exercise that was never used. Exercises with history are
 * archived instead so past workouts keep their names.
 * Returns what happened.
 */
export function removeExercise(db: DB, id: number): 'deleted' | 'archived' {
  const { uses } = db
    .select({ uses: count() })
    .from(sessionExercises)
    .where(eq(sessionExercises.exerciseId, id))
    .get()!;
  if (uses > 0) {
    setExerciseArchived(db, id, true);
    return 'archived';
  }
  db.delete(exercises).where(eq(exercises.id, id)).run();
  return 'deleted';
}
