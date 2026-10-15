/**
 * Queueing local changes for the server, and converting between local rows and
 * the wire format. Callers run these inside a Dexie transaction that also
 * writes the row, so a change and its outbox entry are saved together.
 */
import type {
  Entity,
  ExerciseData,
  SetData,
  WireExercise,
  WireSet,
  WireWorkout,
  WireWorkoutExercise,
  WorkoutData,
  WorkoutExerciseData,
} from '@/lib/sync-protocol';

import type { GymDB, LocalExercise, LocalSet, LocalWorkout, LocalWorkoutExercise, OutboxEntry } from './db';

export type SyncedEntity = Exclude<Entity, 'settings'>;

// ---- local row → mutation payload ----

export const toData = {
  exercise: (r: LocalExercise): ExerciseData => ({
    name: r.name,
    muscleGroup: r.muscleGroup,
    videoUrl: r.videoUrl,
    archived: r.archived,
  }),
  workout: (r: LocalWorkout): WorkoutData => ({
    startedAt: r.startedAt.toISOString(),
    endedAt: r.endedAt ? r.endedAt.toISOString() : null,
    notes: r.notes,
  }),
  workoutExercise: (r: LocalWorkoutExercise): WorkoutExerciseData => ({
    workoutId: r.workoutId,
    exerciseId: r.exerciseId,
    position: r.position,
    notes: r.notes,
  }),
  set: (r: LocalSet): SetData => ({
    workoutExerciseId: r.workoutExerciseId,
    position: r.position,
    weight: r.weight,
    unit: r.unit,
    reps: r.reps,
    durationSec: r.durationSec,
    rpe: r.rpe,
    notes: r.notes,
    completedAt: r.completedAt.toISOString(),
  }),
};

// ---- wire row → local row ----

export const fromWire = {
  exercise: (r: WireExercise): LocalExercise => ({
    id: r.id,
    version: r.version,
    name: r.name,
    muscleGroup: r.muscleGroup,
    videoUrl: r.videoUrl,
    archived: r.archived,
    createdAt: new Date(r.createdAt),
  }),
  workout: (r: WireWorkout): LocalWorkout => ({
    id: r.id,
    version: r.version,
    startedAt: new Date(r.startedAt),
    endedAt: r.endedAt ? new Date(r.endedAt) : null,
    notes: r.notes,
  }),
  workoutExercise: (r: WireWorkoutExercise): LocalWorkoutExercise => ({
    id: r.id,
    version: r.version,
    workoutId: r.workoutId,
    exerciseId: r.exerciseId,
    position: r.position,
    notes: r.notes,
  }),
  set: (r: WireSet): LocalSet => ({
    id: r.id,
    version: r.version,
    workoutExerciseId: r.workoutExerciseId,
    position: r.position,
    weight: r.weight,
    unit: r.unit,
    reps: r.reps,
    durationSec: r.durationSec,
    rpe: r.rpe,
    notes: r.notes,
    completedAt: new Date(r.completedAt),
  }),
};

export const TABLE_OF = {
  exercise: 'exercises',
  workout: 'workouts',
  workoutExercise: 'workoutExercises',
  set: 'sets',
} as const satisfies Record<SyncedEntity, string>;

export function entriesFor(db: GymDB, entity: Entity, entityId: string) {
  return db.outbox.where('[entity+entityId]').equals([entity, entityId]);
}

/**
 * Queues an upsert with the record's full current state. A queued change that
 * was never sent is updated in place, so ten edits offline send one change.
 */
export async function queueUpsert(
  db: GymDB,
  entity: Entity,
  entityId: string,
  data: unknown,
  baseVersion: number,
): Promise<void> {
  const unsent = await entriesFor(db, entity, entityId)
    .filter((e) => e.status === 'pending' && e.attempts === 0)
    .last();
  if (unsent && unsent.op === 'upsert') {
    await db.outbox.update(unsent.seq!, { data });
    return;
  }
  await db.outbox.add(newEntry(entity, entityId, 'upsert', baseVersion, data));
}

/**
 * Queues a delete. If the record never reached the server (created on this
 * device, nothing sent yet), its queued changes are dropped instead.
 */
export async function queueDelete(db: GymDB, entity: Entity, entityId: string, version: number): Promise<void> {
  const entries = await entriesFor(db, entity, entityId).toArray();
  const neverSent = version === 0 && entries.every((e) => e.attempts === 0);
  const unsent = entries.filter((e) => e.attempts === 0).map((e) => e.seq!);
  await db.outbox.bulkDelete(unsent);
  if (neverSent) return;
  await db.outbox.add(newEntry(entity, entityId, 'delete', version, undefined));
}

/**
 * Drops a child record's unsent changes when its parent is deleted (the
 * server deletes children with their parent). Changes already sent stay
 * queued so the server sees them in order.
 */
export async function dropUnsent(db: GymDB, entity: Entity, entityIds: string[]): Promise<void> {
  if (entityIds.length === 0) return;
  const keys = entityIds.map((id) => [entity, id] as [string, string]);
  await db.outbox
    .where('[entity+entityId]')
    .anyOf(keys)
    .filter((e) => e.attempts === 0)
    .delete();
}

function newEntry(
  entity: Entity,
  entityId: string,
  op: OutboxEntry['op'],
  baseVersion: number,
  data: unknown,
): OutboxEntry {
  return {
    mutationId: crypto.randomUUID(),
    entity,
    entityId,
    op,
    baseVersion,
    data,
    status: 'pending',
    attempts: 0,
    createdAt: new Date(),
  };
}
