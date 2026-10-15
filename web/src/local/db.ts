/**
 * The on-device database (IndexedDB via Dexie): one per signed-in user, named
 * `gym-<userId>`. Every workout screen reads and writes this; the sync engine
 * (sync-engine.ts) exchanges changes with the server. See docs/OFFLINE-PLAN.md.
 */
import Dexie, { type Table } from 'dexie';

import type { Entity, WireRow } from '@/lib/sync-protocol';
import type { WeightUnit } from '@/lib/units';

/** `version` is the server version this copy is based on; 0 = not on the server yet. */
type Synced = { id: string; version: number };

export type LocalExercise = Synced & {
  name: string;
  muscleGroup: string | null;
  videoUrl: string | null;
  archived: boolean;
  createdAt: Date;
};

export type LocalWorkout = Synced & {
  startedAt: Date;
  /** null = in progress */
  endedAt: Date | null;
  notes: string | null;
};

export type LocalWorkoutExercise = Synced & {
  workoutId: string;
  exerciseId: string;
  position: number;
  notes: string | null;
};

export type LocalSet = Synced & {
  workoutExerciseId: string;
  position: number;
  /** null = bodyweight */
  weight: number | null;
  unit: WeightUnit;
  reps: number | null;
  durationSec: number | null;
  rpe: number | null;
  notes: string | null;
  completedAt: Date;
};

/** A change waiting to reach the server. Ordered by `seq` (insertion order). */
export type OutboxEntry = {
  seq?: number;
  /** Idempotency key sent to the server. */
  mutationId: string;
  entity: Entity;
  entityId: string;
  op: 'upsert' | 'delete';
  baseVersion: number;
  /** Full record (wire format) for an upsert. */
  data?: unknown;
  /** 'failed' = the server rejected it; waits for the user to retry or discard. */
  status: 'pending' | 'failed';
  /** Times sent. An entry sent at least once may already be applied, so it's never edited in place. */
  attempts: number;
  error?: string;
  createdAt: Date;
};

/** A change the server didn't apply because the record changed elsewhere. */
export type ConflictEntry = {
  id?: number;
  entity: Entity;
  entityId: string;
  /** What this device tried to save (wire format), or null for a delete. */
  local: unknown;
  /** The server's copy at the time, or null if it was deleted. */
  server: WireRow | null;
  message: string;
  createdAt: Date;
};

type MetaValues = { pullCursor: string; lastSyncAt: Date; defaultUnit: WeightUnit };
export type MetaEntry = { [K in keyof MetaValues]: { key: K; value: MetaValues[K] } }[keyof MetaValues];

export class GymDB extends Dexie {
  exercises!: Table<LocalExercise, string>;
  workouts!: Table<LocalWorkout, string>;
  workoutExercises!: Table<LocalWorkoutExercise, string>;
  sets!: Table<LocalSet, string>;
  outbox!: Table<OutboxEntry, number>;
  conflicts!: Table<ConflictEntry, number>;
  meta!: Table<MetaEntry, string>;

  constructor(name: string) {
    super(name);
    // Add new versions below; never change an existing one (devices may be on any of them).
    this.version(1).stores({
      exercises: 'id',
      workouts: 'id, startedAt',
      workoutExercises: 'id, workoutId, exerciseId',
      sets: 'id, workoutExerciseId',
      outbox: '++seq, [entity+entityId], status',
      conflicts: '++id',
      meta: 'key',
    });
  }
}

export const DATA_TABLES = ['exercises', 'workouts', 'workoutExercises', 'sets'] as const;

export const userDbName = (userId: string) => `gym-${userId}`;

export function openUserDb(userId: string): GymDB {
  return new GymDB(userDbName(userId));
}

export async function getMeta<K extends keyof MetaValues>(db: GymDB, key: K): Promise<MetaValues[K] | undefined> {
  return (await db.meta.get(key))?.value as MetaValues[K] | undefined;
}

export function setMeta<K extends keyof MetaValues>(db: GymDB, key: K, value: MetaValues[K]): Promise<string> {
  return db.meta.put({ key, value } as MetaEntry);
}
