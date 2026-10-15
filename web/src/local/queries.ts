/**
 * Read models for the screens, computed from the on-device database. Used
 * with Dexie's useLiveQuery, so screens update as soon as anything changes:
 * a local edit or a sync.
 */
import type { GymDB, LocalExercise, LocalSet, LocalWorkout, LocalWorkoutExercise } from './db';
import { getMeta } from './db';
import type { WeightUnit } from '@/lib/units';

export type SetRow = LocalSet;

export type WorkoutExerciseRow = {
  id: string;
  position: number;
  notes: string | null;
  exercise: Pick<LocalExercise, 'id' | 'name' | 'muscleGroup' | 'videoUrl'>;
  sets: SetRow[];
};

export type WorkoutDetail = LocalWorkout & { exercises: WorkoutExerciseRow[]; unsynced: boolean };

export type WorkoutSummary = {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
  /** Some of it hasn't reached the server yet. */
  unsynced: boolean;
  exercises: { name: string; sets: SetRow[] }[];
};

export type ExerciseSession = { workoutId: string; startedAt: Date; sets: SetRow[] };

const byPosition = <T extends { position: number; id: string }>(a: T, b: T) =>
  a.position - b.position || a.id.localeCompare(b.id);
const bySetOrder = (a: LocalSet, b: LocalSet) =>
  a.position - b.position || a.completedAt.getTime() - b.completedAt.getTime() || a.id.localeCompare(b.id);

/** An exercise that hasn't arrived yet (sync in progress) still renders. */
const unknownExercise = (id: string) => ({ id, name: 'Exercise', muscleGroup: null, videoUrl: null });

export async function getDefaultUnit(db: GymDB): Promise<WeightUnit> {
  return (await getMeta(db, 'defaultUnit')) ?? 'lb';
}

/** "entity:id" for every record with a change waiting to be sent. */
export async function queuedKeys(db: GymDB): Promise<Set<string>> {
  return new Set((await db.outbox.toArray()).map((e) => `${e.entity}:${e.entityId}`));
}

/** Loads workouts' exercises and sets in three bulk reads. */
async function loadContents(db: GymDB, workouts: LocalWorkout[]) {
  const workoutExercises = workouts.length
    ? await db.workoutExercises.where('workoutId').anyOf(workouts.map((w) => w.id)).toArray()
    : [];
  const sets = workoutExercises.length
    ? await db.sets.where('workoutExerciseId').anyOf(workoutExercises.map((we) => we.id)).toArray()
    : [];
  const exerciseIds = [...new Set(workoutExercises.map((we) => we.exerciseId))];
  const exercises = new Map(
    (await db.exercises.bulkGet(exerciseIds)).filter((e): e is LocalExercise => !!e).map((e) => [e.id, e]),
  );
  const setsByExercise = Map.groupBy(sets.sort(bySetOrder), (s) => s.workoutExerciseId);
  const byWorkout = Map.groupBy(workoutExercises.sort(byPosition), (we) => we.workoutId);
  return { exercises, setsByExercise, byWorkout };
}

function isUnsynced(
  workout: LocalWorkout,
  rows: LocalWorkoutExercise[],
  setsByExercise: Map<string, LocalSet[]>,
  queued: Set<string>,
): boolean {
  if (workout.version === 0 || queued.has(`workout:${workout.id}`)) return true;
  return rows.some(
    (we) =>
      queued.has(`workoutExercise:${we.id}`) ||
      (setsByExercise.get(we.id) ?? []).some((s) => queued.has(`set:${s.id}`)),
  );
}

export async function getWorkoutDetail(db: GymDB, id: string): Promise<WorkoutDetail | null> {
  const workout = await db.workouts.get(id);
  if (!workout) return null;
  const { exercises, setsByExercise, byWorkout } = await loadContents(db, [workout]);
  const rows = byWorkout.get(id) ?? [];
  return {
    ...workout,
    unsynced: isUnsynced(workout, rows, setsByExercise, await queuedKeys(db)),
    exercises: rows.map((we) => ({
      id: we.id,
      position: we.position,
      notes: we.notes,
      exercise: exercises.get(we.exerciseId) ?? unknownExercise(we.exerciseId),
      sets: setsByExercise.get(we.id) ?? [],
    })),
  };
}

/** Workouts in progress, newest first (normally at most one). */
export async function getInProgress(db: GymDB): Promise<LocalWorkout[]> {
  return (await db.workouts.orderBy('startedAt').reverse().toArray()).filter((w) => w.endedAt === null);
}

/** Finished workouts, newest first: the first `limit`, and how many there are. */
export async function listFinishedWorkouts(
  db: GymDB,
  limit: number,
): Promise<{ workouts: WorkoutSummary[]; total: number }> {
  const finished = (await db.workouts.orderBy('startedAt').reverse().toArray()).filter((w) => w.endedAt !== null);
  const page = finished.slice(0, limit);
  const [{ exercises, setsByExercise, byWorkout }, queued] = await Promise.all([
    loadContents(db, page),
    queuedKeys(db),
  ]);
  return {
    total: finished.length,
    workouts: page.map((w) => {
      const rows = byWorkout.get(w.id) ?? [];
      return {
        id: w.id,
        startedAt: w.startedAt,
        endedAt: w.endedAt,
        unsynced: isUnsynced(w, rows, setsByExercise, queued),
        exercises: rows.map((we) => ({
          name: (exercises.get(we.exerciseId) ?? unknownExercise(we.exerciseId)).name,
          sets: setsByExercise.get(we.id) ?? [],
        })),
      };
    }),
  };
}

/** Every workout that logged sets for this exercise, newest first. */
export async function getExerciseHistory(
  db: GymDB,
  exerciseId: string,
  { excludeWorkoutId, limit }: { excludeWorkoutId?: string; limit?: number } = {},
): Promise<ExerciseSession[]> {
  const rows = (await db.workoutExercises.where('exerciseId').equals(exerciseId).toArray()).filter(
    (we) => we.workoutId !== excludeWorkoutId,
  );
  if (rows.length === 0) return [];
  const [workouts, sets] = await Promise.all([
    db.workouts.bulkGet([...new Set(rows.map((r) => r.workoutId))]),
    db.sets.where('workoutExerciseId').anyOf(rows.map((r) => r.id)).toArray(),
  ]);
  const startedAt = new Map(workouts.filter((w): w is LocalWorkout => !!w).map((w) => [w.id, w.startedAt]));
  const setsByRow = Map.groupBy(sets.sort(bySetOrder), (s) => s.workoutExerciseId);

  // The same exercise can appear twice in one workout; merge those.
  const sessions = new Map<string, ExerciseSession>();
  for (const row of rows.sort(byPosition)) {
    const date = startedAt.get(row.workoutId);
    const rowSets = setsByRow.get(row.id) ?? [];
    if (!date || rowSets.length === 0) continue;
    const session = sessions.get(row.workoutId) ?? { workoutId: row.workoutId, startedAt: date, sets: [] };
    session.sets.push(...rowSets);
    sessions.set(row.workoutId, session);
  }
  const result = [...sessions.values()].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  return limit === undefined ? result : result.slice(0, limit);
}

/** "Last time" for each exercise: its most recent other workout, keyed by exercise id. */
export async function getLastPerformances(
  db: GymDB,
  exerciseIds: string[],
  excludeWorkoutId: string,
): Promise<Record<string, ExerciseSession>> {
  const entries = await Promise.all(
    [...new Set(exerciseIds)].map(
      async (id) => [id, (await getExerciseHistory(db, id, { excludeWorkoutId, limit: 1 }))[0]] as const,
    ),
  );
  return Object.fromEntries(entries.filter((e): e is [string, ExerciseSession] => !!e[1]));
}

export async function listExercises(db: GymDB): Promise<LocalExercise[]> {
  return (await db.exercises.toArray()).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}
