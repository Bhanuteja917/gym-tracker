/**
 * Everything the app changes, written to the on-device database first. Each
 * function saves the row and queues it for the server in one transaction, so
 * nothing is lost if the app closes, and nothing waits for the network.
 */
import { DEFAULT_MUSCLE_GROUPS } from '@/lib/exercises';
import { dayKey, type DayKey, parseDayKey } from '@/lib/dot-grid';
import type { Settings } from '@/lib/settings';
import type { ExerciseInput, SetInput } from '@/lib/validation';

import { getSettings, type GymDB, type LocalExercise, type LocalSet, type LocalWorkout, storeSettings } from './db';
import { dropUnsent, fromWire, queueDelete, queueUpsert, TABLE_OF, toData } from './outbox';

/** A user-facing reason a change can't be made. */
export class LocalError extends Error {}

const newId = () => crypto.randomUUID();

const ALL = (db: GymDB) => [db.exercises, db.workouts, db.workoutExercises, db.sets, db.outbox, db.meta];

async function mustGet<T>(promise: Promise<T | undefined>, what: string): Promise<T> {
  const row = await promise;
  if (!row) throw new LocalError(`${what} not found`);
  return row;
}

// ---- Workouts ----

export async function inProgressWorkouts(db: GymDB): Promise<LocalWorkout[]> {
  return (await db.workouts.orderBy('startedAt').reverse().toArray()).filter((w) => w.endedAt === null);
}

/** Starts a workout, or returns the one already in progress. */
export async function startWorkout(db: GymDB, now = new Date()): Promise<string> {
  return db.transaction('rw', ALL(db), async () => {
    const active = (await inProgressWorkouts(db))[0];
    if (active) return active.id;
    const workout: LocalWorkout = { id: newId(), version: 0, startedAt: now, endedAt: null, notes: null };
    await db.workouts.add(workout);
    await queueUpsert(db, 'workout', workout.id, toData.workout(workout), 0);
    return workout.id;
  });
}

async function saveWorkout(db: GymDB, workout: LocalWorkout): Promise<void> {
  await db.workouts.put(workout);
  await queueUpsert(db, 'workout', workout.id, toData.workout(workout), workout.version);
}

/** Finishes a workout. One with no sets is discarded instead. */
export async function finishWorkout(db: GymDB, id: string, now = new Date()): Promise<{ discarded: boolean }> {
  return db.transaction('rw', ALL(db), async () => {
    const workout = await mustGet(db.workouts.get(id), 'Workout');
    const exerciseIds = await db.workoutExercises.where('workoutId').equals(id).primaryKeys();
    const sets = exerciseIds.length ? await db.sets.where('workoutExerciseId').anyOf(exerciseIds).count() : 0;
    if (sets === 0) {
      await deleteWorkoutInTx(db, workout);
      return { discarded: true };
    }
    if (workout.endedAt === null) await saveWorkout(db, { ...workout, endedAt: now });
    // A logged workout replaces a day marked as attended without one.
    for (const marked of await markedOnlyOn(db, dayKey(workout.startedAt))) await deleteWorkoutInTx(db, marked);
    return { discarded: false };
  });
}

// ---- Attendance without a logged workout ----

/** Finished workouts with no exercises: days marked as attended without logging anything. */
async function markedOnlyOn(db: GymDB, day: DayKey): Promise<LocalWorkout[]> {
  const date = parseDayKey(day);
  if (!date) return [];
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  const workouts = await db.workouts.where('startedAt').between(date, next, true, false).toArray();
  const marked: LocalWorkout[] = [];
  for (const w of workouts) {
    if (w.endedAt !== null && (await db.workoutExercises.where('workoutId').equals(w.id).count()) === 0) marked.push(w);
  }
  return marked;
}

/**
 * Marks a day as a gym day without logging exercises: saves a finished, empty
 * workout on it (at the current time for today, midday for a past day).
 * Does nothing if the day already has a finished workout.
 */
export async function markGymDay(db: GymDB, day: DayKey, now = new Date()): Promise<void> {
  const date = parseDayKey(day);
  if (!date) throw new LocalError('Not a date');
  if (day > dayKey(now)) throw new LocalError('That day hasn’t happened yet');
  await db.transaction('rw', ALL(db), async () => {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    const existing = await db.workouts.where('startedAt').between(date, next, true, false).toArray();
    if (existing.some((w) => w.endedAt !== null)) return;
    const at = day === dayKey(now) ? now : new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
    const workout: LocalWorkout = { id: newId(), version: 0, startedAt: at, endedAt: at, notes: null };
    await db.workouts.add(workout);
    await queueUpsert(db, 'workout', workout.id, toData.workout(workout), 0);
  });
}

/** Removes a day's attendance marks. Workouts with exercises are kept: delete those from History. */
export async function unmarkGymDay(db: GymDB, day: DayKey): Promise<void> {
  await db.transaction('rw', ALL(db), async () => {
    const marked = await markedOnlyOn(db, day);
    if (marked.length === 0) throw new LocalError('This day has a logged workout. Delete it from History instead.');
    for (const w of marked) await deleteWorkoutInTx(db, w);
  });
}

/** Reopens a finished workout. Refused while another is in progress. */
export async function resumeWorkout(db: GymDB, id: string): Promise<void> {
  await db.transaction('rw', ALL(db), async () => {
    const workout = await mustGet(db.workouts.get(id), 'Workout');
    if (workout.endedAt === null) return;
    if ((await inProgressWorkouts(db)).length > 0) {
      throw new LocalError('Finish the workout in progress first');
    }
    await saveWorkout(db, { ...workout, endedAt: null });
  });
}

export async function updateWorkoutNotes(db: GymDB, id: string, notes: string | null): Promise<void> {
  await db.transaction('rw', ALL(db), async () => {
    const workout = await mustGet(db.workouts.get(id), 'Workout');
    if (workout.notes === notes) return;
    await saveWorkout(db, { ...workout, notes });
  });
}

export async function deleteWorkout(db: GymDB, id: string): Promise<void> {
  await db.transaction('rw', ALL(db), async () => {
    const workout = await db.workouts.get(id);
    if (workout) await deleteWorkoutInTx(db, workout);
  });
}

async function deleteWorkoutInTx(db: GymDB, workout: LocalWorkout): Promise<void> {
  const exerciseIds = await db.workoutExercises.where('workoutId').equals(workout.id).primaryKeys();
  const setIds = exerciseIds.length ? await db.sets.where('workoutExerciseId').anyOf(exerciseIds).primaryKeys() : [];
  // The server deletes the contents with the workout; only the workout's delete is sent.
  await dropUnsent(db, 'set', setIds);
  await dropUnsent(db, 'workoutExercise', exerciseIds);
  await db.sets.bulkDelete(setIds);
  await db.workoutExercises.bulkDelete(exerciseIds);
  await db.workouts.delete(workout.id);
  await queueDelete(db, 'workout', workout.id, workout.version);
}

// ---- Exercises within a workout ----

/** Adds an exercise to the end of a workout. */
export async function addExerciseToWorkout(db: GymDB, workoutId: string, exerciseId: string): Promise<string> {
  return db.transaction('rw', ALL(db), async () => {
    await mustGet(db.workouts.get(workoutId), 'Workout');
    await mustGet(db.exercises.get(exerciseId), 'Exercise');
    const siblings = await db.workoutExercises.where('workoutId').equals(workoutId).toArray();
    const row = {
      id: newId(),
      version: 0,
      workoutId,
      exerciseId,
      position: Math.max(-1, ...siblings.map((s) => s.position)) + 1,
      notes: null,
    };
    await db.workoutExercises.add(row);
    await queueUpsert(db, 'workoutExercise', row.id, toData.workoutExercise(row), 0);
    return row.id;
  });
}

/** Removes an exercise and its sets from a workout. */
export async function removeWorkoutExercise(db: GymDB, workoutExerciseId: string): Promise<void> {
  await db.transaction('rw', ALL(db), async () => {
    const row = await db.workoutExercises.get(workoutExerciseId);
    if (!row) return;
    const setIds = await db.sets.where('workoutExerciseId').equals(row.id).primaryKeys();
    await dropUnsent(db, 'set', setIds);
    await db.sets.bulkDelete(setIds);
    await db.workoutExercises.delete(row.id);
    await queueDelete(db, 'workoutExercise', row.id, row.version);
  });
}

// ---- Sets ----

/** Logs a set at the end of a workout exercise. */
export async function addSet(db: GymDB, workoutExerciseId: string, input: SetInput, now = new Date()): Promise<string> {
  return db.transaction('rw', ALL(db), async () => {
    await mustGet(db.workoutExercises.get(workoutExerciseId), 'Exercise');
    const siblings = await db.sets.where('workoutExerciseId').equals(workoutExerciseId).toArray();
    const set: LocalSet = {
      id: newId(),
      version: 0,
      workoutExerciseId,
      position: Math.max(-1, ...siblings.map((s) => s.position)) + 1,
      completedAt: now,
      ...input,
    };
    await db.sets.add(set);
    await queueUpsert(db, 'set', set.id, toData.set(set), 0);
    return set.id;
  });
}

export async function updateSet(db: GymDB, setId: string, input: SetInput): Promise<void> {
  await db.transaction('rw', ALL(db), async () => {
    const set = { ...(await mustGet(db.sets.get(setId), 'Set')), ...input };
    await db.sets.put(set);
    await queueUpsert(db, 'set', set.id, toData.set(set), set.version);
  });
}

export async function deleteSet(db: GymDB, setId: string): Promise<void> {
  await db.transaction('rw', ALL(db), async () => {
    const set = await db.sets.get(setId);
    if (!set) return;
    await db.sets.delete(setId);
    await queueDelete(db, 'set', set.id, set.version);
  });
}

// ---- Exercise library ----

async function assertNameFree(db: GymDB, name: string, exceptId?: string): Promise<void> {
  const key = name.toLowerCase();
  const clash = await db.exercises.filter((e) => e.id !== exceptId && e.name.toLowerCase() === key).first();
  if (clash) throw new LocalError(`An exercise named "${name}" already exists`);
}

async function saveExercise(db: GymDB, exercise: LocalExercise): Promise<void> {
  await db.exercises.put(exercise);
  await queueUpsert(db, 'exercise', exercise.id, toData.exercise(exercise), exercise.version);
}

/** Creates an exercise; with a workout id, also adds it to that workout. */
export async function createExercise(db: GymDB, input: ExerciseInput, addToWorkoutId?: string): Promise<string> {
  return db.transaction('rw', ALL(db), async () => {
    await assertNameFree(db, input.name);
    const exercise: LocalExercise = { id: newId(), version: 0, archived: false, createdAt: new Date(), ...input };
    await saveExercise(db, exercise);
    if (addToWorkoutId) await addExerciseToWorkout(db, addToWorkoutId, exercise.id);
    return exercise.id;
  });
}

export async function updateExercise(db: GymDB, id: string, input: ExerciseInput): Promise<void> {
  await db.transaction('rw', ALL(db), async () => {
    const exercise = await mustGet(db.exercises.get(id), 'Exercise');
    await assertNameFree(db, input.name, id);
    await saveExercise(db, { ...exercise, ...input });
  });
}

export async function setExerciseArchived(db: GymDB, id: string, archived: boolean): Promise<void> {
  await db.transaction('rw', ALL(db), async () => {
    const exercise = await mustGet(db.exercises.get(id), 'Exercise');
    await saveExercise(db, { ...exercise, archived });
  });
}

/** Deletes an exercise that was never logged. One with history can only be archived. */
export async function deleteExercise(db: GymDB, id: string): Promise<void> {
  await db.transaction('rw', ALL(db), async () => {
    const exercise = await mustGet(db.exercises.get(id), 'Exercise');
    if ((await db.workoutExercises.where('exerciseId').equals(id).count()) > 0) {
      throw new LocalError('This exercise has history. Archive it instead.');
    }
    await db.exercises.delete(id);
    await queueDelete(db, 'exercise', id, exercise.version);
  });
}

/** Default groups first, then any other names in use, without case duplicates. */
export function muscleGroupsFrom(exercises: readonly { muscleGroup: string | null }[]): string[] {
  const names = [...DEFAULT_MUSCLE_GROUPS];
  for (const { muscleGroup } of [...exercises].sort((a, b) => (a.muscleGroup ?? '').localeCompare(b.muscleGroup ?? ''))) {
    if (muscleGroup && !names.some((n) => n.toLowerCase() === muscleGroup.toLowerCase())) names.push(muscleGroup);
  }
  return names;
}

// ---- Settings ----

/** Changes preferences. They sync as one record; the last device to change them wins. */
export async function updateSettings(db: GymDB, changes: Partial<Settings>): Promise<void> {
  await db.transaction('rw', ALL(db), async () => {
    const settings = { ...(await getSettings(db)), ...changes };
    await storeSettings(db, settings);
    await queueUpsert(db, 'settings', 'settings', settings, 0);
  });
}

// ---- Sync review ----

/**
 * Applies a change the server turned down because the record had changed
 * elsewhere, on top of the record as it is now.
 */
export async function reapplyConflict(db: GymDB, conflictId: number): Promise<void> {
  await db.transaction('rw', [...ALL(db), db.conflicts], async () => {
    const conflict = await mustGet(db.conflicts.get(conflictId), 'Change');
    if (conflict.entity === 'settings' || conflict.local === null) {
      throw new LocalError('This change can’t be re-applied');
    }
    const entity = conflict.entity;
    const table = db.table(TABLE_OF[entity]);
    const current = (await table.get(conflict.entityId)) as { version: number; createdAt?: Date } | undefined;
    if (!current) throw new LocalError('It was deleted on another device, so it can’t be re-applied');
    const wire = {
      ...(conflict.local as object),
      id: conflict.entityId,
      version: current.version,
      deletedAt: null,
      createdAt: current.createdAt?.toISOString(),
    };
    const row = fromWire[entity](wire as never);
    await table.put(row);
    await queueUpsert(db, entity, conflict.entityId, toData[entity](row as never), current.version);
    await db.conflicts.delete(conflictId);
  });
}
