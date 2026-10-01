import { and, asc, desc, eq, gt, lt, max } from 'drizzle-orm';

import {
  planDays,
  planExercises,
  type Exercise,
  type PlanExercise,
  type WeightUnit,
} from '@/db/schema';
import type { DB } from '@/db/types';
import { getDefaultUnit } from '@/data/settings';
import { WEEKDAYS, type Weekday } from '@/lib/days';

export type PlannedExercise = PlanExercise & { exercise: Exercise };

export type PlanDay = {
  weekday: Weekday;
  name: string | null;
  exercises: PlannedExercise[];
};

export type PlanTargets = {
  targetSets: number | null;
  targetReps: number | null;
  targetWeight: number | null;
  targetUnit: WeightUnit;
};

function plannedExercises(db: DB, weekday?: Weekday): PlannedExercise[] {
  return db.query.planExercises
    .findMany({
      where: weekday === undefined ? undefined : eq(planExercises.weekday, weekday),
      orderBy: [asc(planExercises.weekday), asc(planExercises.position)],
      with: { exercise: true },
    })
    .sync();
}

/** All seven days, Monday first. Days never edited come back as unnamed rest days. */
export function getWeekPlan(db: DB): PlanDay[] {
  const names = new Map(db.select().from(planDays).all().map((d) => [d.weekday, d.name]));
  const all = plannedExercises(db);
  return WEEKDAYS.map((weekday) => ({
    weekday,
    name: names.get(weekday) ?? null,
    exercises: all.filter((e) => e.weekday === weekday),
  }));
}

export function getPlanDay(db: DB, weekday: Weekday): PlanDay {
  const row = db.select().from(planDays).where(eq(planDays.weekday, weekday)).get();
  return { weekday, name: row?.name ?? null, exercises: plannedExercises(db, weekday) };
}

/** "Rest day", or e.g. "Push · 5 exercises" ("Workout" when the day has no name). */
export function describePlanDay(day: PlanDay): string {
  const n = day.exercises.length;
  if (n === 0) return 'Rest day';
  return `${day.name ?? 'Workout'} · ${n} exercise${n === 1 ? '' : 's'}`;
}

export function setPlanDayName(db: DB, weekday: Weekday, name: string): void {
  const value = name.trim() === '' ? null : name.trim();
  db.insert(planDays)
    .values({ weekday, name: value })
    .onConflictDoUpdate({ target: planDays.weekday, set: { name: value } })
    .run();
}

/** Adds an exercise to the end of a day. Adding one that is already there returns the existing entry. */
export function addPlanExercise(db: DB, weekday: Weekday, exerciseId: number): PlanExercise {
  const existing = db
    .select()
    .from(planExercises)
    .where(and(eq(planExercises.weekday, weekday), eq(planExercises.exerciseId, exerciseId)))
    .get();
  if (existing) return existing;

  db.insert(planDays).values({ weekday }).onConflictDoNothing().run();
  const { last } = db
    .select({ last: max(planExercises.position) })
    .from(planExercises)
    .where(eq(planExercises.weekday, weekday))
    .get()!;
  return db
    .insert(planExercises)
    .values({ weekday, exerciseId, position: (last ?? -1) + 1, targetUnit: getDefaultUnit(db) })
    .returning()
    .get();
}

export function getPlanExercise(db: DB, id: number): PlannedExercise | undefined {
  return db.query.planExercises
    .findFirst({ where: eq(planExercises.id, id), with: { exercise: true } })
    .sync();
}

export function updatePlanTargets(db: DB, id: number, targets: PlanTargets): void {
  db.update(planExercises).set(targets).where(eq(planExercises.id, id)).run();
}

/** Swaps an exercise with its neighbour above (-1) or below (1). No-op at either end. */
export function movePlanExercise(db: DB, id: number, direction: -1 | 1): void {
  const item = db.select().from(planExercises).where(eq(planExercises.id, id)).get();
  if (!item) return;
  const neighbour = db
    .select()
    .from(planExercises)
    .where(
      and(
        eq(planExercises.weekday, item.weekday),
        direction < 0
          ? lt(planExercises.position, item.position)
          : gt(planExercises.position, item.position),
      ),
    )
    .orderBy(direction < 0 ? desc(planExercises.position) : asc(planExercises.position))
    .limit(1)
    .get();
  if (!neighbour) return;
  db.transaction((tx) => {
    tx.update(planExercises).set({ position: neighbour.position }).where(eq(planExercises.id, item.id)).run();
    tx.update(planExercises).set({ position: item.position }).where(eq(planExercises.id, neighbour.id)).run();
  });
}

export function removePlanExercise(db: DB, id: number): void {
  db.delete(planExercises).where(eq(planExercises.id, id)).run();
}

/** Removes a day's name and exercises, making it a rest day. */
export function clearPlanDay(db: DB, weekday: Weekday): void {
  db.delete(planDays).where(eq(planDays.weekday, weekday)).run();
}
