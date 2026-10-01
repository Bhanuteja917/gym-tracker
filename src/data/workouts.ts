import { and, asc, count, desc, eq, inArray, isNull, max } from 'drizzle-orm';

import {
  exercises,
  sessionExercises,
  sessions,
  setEntries,
  type Exercise,
  type Session,
  type SessionExercise,
  type SetEntry,
  type WeightUnit,
} from '@/db/schema';
import type { DB } from '@/db/types';
import { getLastPerformance } from '@/data/history';
import { getPlanDay } from '@/data/plan';
import { getDefaultUnit } from '@/data/settings';
import type { Weekday } from '@/lib/days';

export type WorkoutExercise = SessionExercise & { exercise: Exercise; sets: SetEntry[] };
export type Workout = Session & { exercises: WorkoutExercise[] };

export type WorkoutSummary = Session & {
  exerciseNames: string[];
  setCount: number;
};

// ---- Sessions --------------------------------------------------------------

export function getActiveSession(db: DB): Session | undefined {
  return db
    .select()
    .from(sessions)
    .where(isNull(sessions.endedAt))
    .orderBy(desc(sessions.startedAt))
    .limit(1)
    .get();
}

/** Starts a workout, or returns the one already in progress. */
export function startSession(db: DB, now = Date.now()): Session {
  return (
    getActiveSession(db) ?? db.insert(sessions).values({ startedAt: now }).returning().get()
  );
}

/**
 * Starts a workout from a weekly-plan day: its exercises are added in order
 * with their targets copied in. Returns the workout already in progress, if any.
 */
export function startPlannedSession(db: DB, weekday: Weekday, now = Date.now()): Session {
  const active = getActiveSession(db);
  if (active) return active;
  const day = getPlanDay(db, weekday);
  return db.transaction((tx) => {
    const session = tx
      .insert(sessions)
      .values({ startedAt: now, planWeekday: weekday })
      .returning()
      .get();
    day.exercises.forEach((pe, position) => {
      tx.insert(sessionExercises)
        .values({
          sessionId: session.id,
          exerciseId: pe.exerciseId,
          position,
          targetSets: pe.targetSets,
          targetReps: pe.targetReps,
          targetWeight: pe.targetWeight,
          targetUnit: pe.targetUnit,
        })
        .run();
    });
    return session;
  });
}

/**
 * Ends a workout. A workout with no logged sets is discarded rather than
 * kept as an empty entry in history.
 */
export function finishSession(db: DB, id: number, now = Date.now()): 'finished' | 'discarded' {
  if (countSets(db, id) === 0) {
    deleteSession(db, id);
    return 'discarded';
  }
  db.update(sessions).set({ endedAt: now }).where(eq(sessions.id, id)).run();
  return 'finished';
}

/** Makes a finished workout active again, unless another workout is already in progress. */
export function reopenSession(db: DB, id: number): boolean {
  const active = getActiveSession(db);
  if (active && active.id !== id) return false;
  db.update(sessions).set({ endedAt: null }).where(eq(sessions.id, id)).run();
  return true;
}

export function deleteSession(db: DB, id: number): void {
  db.delete(sessions).where(eq(sessions.id, id)).run();
}

export function updateSessionNotes(db: DB, id: number, notes: string): void {
  db.update(sessions)
    .set({ notes: notes.trim() === '' ? null : notes.trim() })
    .where(eq(sessions.id, id))
    .run();
}

function countSets(db: DB, sessionId: number): number {
  return db
    .select({ n: count() })
    .from(setEntries)
    .innerJoin(sessionExercises, eq(setEntries.sessionExerciseId, sessionExercises.id))
    .where(eq(sessionExercises.sessionId, sessionId))
    .get()!.n;
}

export function getWorkout(db: DB, id: number): Workout | undefined {
  return db.query.sessions
    .findFirst({
      where: eq(sessions.id, id),
      with: {
        exercises: {
          orderBy: asc(sessionExercises.position),
          with: { exercise: true, sets: { orderBy: asc(setEntries.position) } },
        },
      },
    })
    .sync();
}

/** Workouts newest first, with the exercise names and set count for each. */
export function listWorkoutSummaries(db: DB): WorkoutSummary[] {
  const rows = db.select().from(sessions).orderBy(desc(sessions.startedAt)).all();
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const names = db
    .select({ sessionId: sessionExercises.sessionId, name: exercises.name })
    .from(sessionExercises)
    .innerJoin(exercises, eq(sessionExercises.exerciseId, exercises.id))
    .where(inArray(sessionExercises.sessionId, ids))
    .orderBy(asc(sessionExercises.sessionId), asc(sessionExercises.position))
    .all();

  const setCounts = db
    .select({ sessionId: sessionExercises.sessionId, n: count() })
    .from(setEntries)
    .innerJoin(sessionExercises, eq(setEntries.sessionExerciseId, sessionExercises.id))
    .where(inArray(sessionExercises.sessionId, ids))
    .groupBy(sessionExercises.sessionId)
    .all();

  const namesBySession = new Map<number, string[]>();
  for (const { sessionId, name } of names) {
    namesBySession.set(sessionId, [...(namesBySession.get(sessionId) ?? []), name]);
  }
  const countBySession = new Map(setCounts.map((c) => [c.sessionId, c.n]));

  return rows.map((r) => ({
    ...r,
    exerciseNames: namesBySession.get(r.id) ?? [],
    setCount: countBySession.get(r.id) ?? 0,
  }));
}

// ---- Exercises within a session -------------------------------------------

/** Adds an exercise to a workout. Adding one that is already there returns the existing entry. */
export function addExerciseToSession(db: DB, sessionId: number, exerciseId: number): SessionExercise {
  const existing = db
    .select()
    .from(sessionExercises)
    .where(and(eq(sessionExercises.sessionId, sessionId), eq(sessionExercises.exerciseId, exerciseId)))
    .get();
  if (existing) return existing;

  const { last } = db
    .select({ last: max(sessionExercises.position) })
    .from(sessionExercises)
    .where(eq(sessionExercises.sessionId, sessionId))
    .get()!;
  return db
    .insert(sessionExercises)
    .values({ sessionId, exerciseId, position: (last ?? -1) + 1 })
    .returning()
    .get();
}

export function removeSessionExercise(db: DB, id: number): void {
  db.delete(sessionExercises).where(eq(sessionExercises.id, id)).run();
}

// ---- Sets -----------------------------------------------------------------

export type SetInput = {
  weight: number | null;
  unit: WeightUnit;
  reps: number;
  rpe?: number | null;
  notes?: string | null;
};

export function logSet(
  db: DB,
  sessionExerciseId: number,
  input: SetInput,
  now = Date.now(),
): SetEntry {
  const { last } = db
    .select({ last: max(setEntries.position) })
    .from(setEntries)
    .where(eq(setEntries.sessionExerciseId, sessionExerciseId))
    .get()!;
  return db
    .insert(setEntries)
    .values({
      sessionExerciseId,
      position: (last ?? -1) + 1,
      weight: input.weight,
      unit: input.unit,
      reps: input.reps,
      rpe: input.rpe ?? null,
      notes: input.notes?.trim() || null,
      completedAt: now,
    })
    .returning()
    .get();
}

export function updateSet(db: DB, id: number, input: SetInput): void {
  db.update(setEntries)
    .set({
      weight: input.weight,
      unit: input.unit,
      reps: input.reps,
      rpe: input.rpe ?? null,
      notes: input.notes?.trim() || null,
    })
    .where(eq(setEntries.id, id))
    .run();
}

export function deleteSet(db: DB, id: number): void {
  db.delete(setEntries).where(eq(setEntries.id, id)).run();
}

export function getSet(db: DB, id: number): SetEntry | undefined {
  return db.select().from(setEntries).where(eq(setEntries.id, id)).get();
}

export type SuggestedSet = { weight: number | null; unit: WeightUnit; reps: number | null };

/**
 * What the set form starts with: the last set logged for this exercise in
 * this workout; otherwise the planned targets, with any field that has no
 * target taken from the previous workout's first set; otherwise empty.
 */
export function suggestedSetValues(db: DB, sessionExerciseId: number): SuggestedSet | undefined {
  const se = db.select().from(sessionExercises).where(eq(sessionExercises.id, sessionExerciseId)).get();
  if (!se) return undefined;

  const lastHere = db
    .select()
    .from(setEntries)
    .where(eq(setEntries.sessionExerciseId, sessionExerciseId))
    .orderBy(desc(setEntries.position))
    .limit(1)
    .get();
  if (lastHere) return { weight: lastHere.weight, unit: lastHere.unit, reps: lastHere.reps };

  const previous = getLastPerformance(db, se.exerciseId, se.sessionId)?.sets[0];
  const defaultUnit = getDefaultUnit(db);
  const weightTarget = se.targetWeight !== null;
  return {
    weight: weightTarget ? se.targetWeight : (previous?.weight ?? null),
    unit: weightTarget ? (se.targetUnit ?? defaultUnit) : (previous?.unit ?? defaultUnit),
    reps: se.targetReps ?? previous?.reps ?? null,
  };
}
