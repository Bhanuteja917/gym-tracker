import { and, asc, count, desc, eq, gt, lt, max, ne, sql } from 'drizzle-orm';

import { exercises, muscleGroups, type MuscleGroup } from '@/db/schema';
import type { DB } from '@/db/types';

/** Groups created on first install (see migration 0004) and for old backups. */
export const DEFAULT_MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Shoulders',
  'Arms',
  'Legs',
  'Core',
  'Cardio',
  'Full body',
] as const;

export function listMuscleGroups(db: DB): MuscleGroup[] {
  return db.select().from(muscleGroups).orderBy(asc(muscleGroups.position)).all();
}

export function getMuscleGroup(db: DB, id: number): MuscleGroup | undefined {
  return db.select().from(muscleGroups).where(eq(muscleGroups.id, id)).get();
}

/** Finds a group by name, ignoring case. */
export function findMuscleGroup(db: DB, name: string): MuscleGroup | undefined {
  return db
    .select()
    .from(muscleGroups)
    .where(sql`lower(${muscleGroups.name}) = lower(${name.trim()})`)
    .get();
}

function normalizeName(db: DB, name: string, exceptId?: number): string {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (trimmed === '') throw new Error('Muscle group name is required');
  const existing = findMuscleGroup(db, trimmed);
  if (existing && existing.id !== exceptId) throw new Error(`"${existing.name}" already exists`);
  return trimmed;
}

export function addMuscleGroup(db: DB, name: string): MuscleGroup {
  const normalized = normalizeName(db, name);
  const { last } = db
    .select({ last: max(muscleGroups.position) })
    .from(muscleGroups)
    .get()!;
  return db
    .insert(muscleGroups)
    .values({ name: normalized, position: (last ?? -1) + 1 })
    .returning()
    .get();
}

/** Renames a group and every exercise tagged with it. */
export function renameMuscleGroup(db: DB, id: number, name: string): void {
  const current = getMuscleGroup(db, id);
  if (!current) return;
  const normalized = normalizeName(db, name, id);
  db.transaction((tx) => {
    tx.update(muscleGroups).set({ name: normalized }).where(eq(muscleGroups.id, id)).run();
    tx.update(exercises)
      .set({ category: normalized })
      .where(sql`lower(${exercises.category}) = lower(${current.name})`)
      .run();
  });
}

export function moveMuscleGroup(db: DB, id: number, direction: -1 | 1): void {
  const item = getMuscleGroup(db, id);
  if (!item) return;
  const neighbour = db
    .select()
    .from(muscleGroups)
    .where(
      and(
        ne(muscleGroups.id, id),
        direction < 0
          ? lt(muscleGroups.position, item.position)
          : gt(muscleGroups.position, item.position),
      ),
    )
    .orderBy(direction < 0 ? desc(muscleGroups.position) : asc(muscleGroups.position))
    .limit(1)
    .get();
  if (!neighbour) return;
  db.transaction((tx) => {
    tx.update(muscleGroups)
      .set({ position: neighbour.position })
      .where(eq(muscleGroups.id, item.id))
      .run();
    tx.update(muscleGroups)
      .set({ position: item.position })
      .where(eq(muscleGroups.id, neighbour.id))
      .run();
  });
}

/** Number of exercises (including archived) tagged with the group. */
export function countExercisesInGroup(db: DB, id: number): number {
  const group = getMuscleGroup(db, id);
  if (!group) return 0;
  return db
    .select({ n: count() })
    .from(exercises)
    .where(sql`lower(${exercises.category}) = lower(${group.name})`)
    .get()!.n;
}

/** Deletes a group; exercises tagged with it are kept with no group. */
export function removeMuscleGroup(db: DB, id: number): void {
  const group = getMuscleGroup(db, id);
  if (!group) return;
  db.transaction((tx) => {
    tx.update(exercises)
      .set({ category: null })
      .where(sql`lower(${exercises.category}) = lower(${group.name})`)
      .run();
    tx.delete(muscleGroups).where(eq(muscleGroups.id, id)).run();
  });
}
