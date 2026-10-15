/**
 * The wire format between the device's local database and /api/sync/*.
 * Shared by the client (src/local/) and the server (src/server/sync.ts).
 * See docs/OFFLINE-PLAN.md for the protocol.
 *
 * Dates travel as ISO strings. Rows carry the server `version` they are at;
 * `deletedAt` is set on tombstones.
 */
import { z } from 'zod';

import { WEIGHT_UNITS } from './units';

/** Bump when the push/pull shapes change incompatibly; the server accepts this and the previous one. */
export const SYNC_PROTOCOL = 1;

/** Max mutations per push request. */
export const PUSH_BATCH_SIZE = 100;

export const ENTITIES = ['exercise', 'workout', 'workoutExercise', 'set', 'settings'] as const;
export type Entity = (typeof ENTITIES)[number];

const id = z.string().min(1).max(64);
const isoDate = z.iso.datetime({ offset: true });
const optionalText = (max: number) => z.string().trim().max(max).nullable();

// ---- Mutation payloads: what a device sends for an upsert ----

export const exerciseDataSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name is too long'),
  muscleGroup: optionalText(50),
  videoUrl: z
    .url({ protocol: /^https?$/, error: 'Enter a full http(s) link' })
    .max(500)
    .nullable(),
  archived: z.boolean(),
});

export const workoutDataSchema = z.object({
  startedAt: isoDate,
  endedAt: isoDate.nullable(),
  notes: optionalText(2000),
});

export const workoutExerciseDataSchema = z.object({
  workoutId: id,
  exerciseId: id,
  position: z.number().int().min(0),
  notes: optionalText(2000),
});

export const setDataSchema = z
  .object({
    workoutExerciseId: id,
    position: z.number().int().min(0),
    weight: z.number().min(0).max(2000).nullable(),
    unit: z.enum(WEIGHT_UNITS),
    reps: z.number().int().min(1).max(1000).nullable(),
    durationSec: z.number().int().min(1).max(86_400).nullable(),
    rpe: z.number().min(1).max(10).nullable(),
    notes: optionalText(500),
    completedAt: isoDate,
  })
  .refine((s) => s.reps !== null || s.durationSec !== null, 'A set needs reps or a duration');

export const settingsDataSchema = z.object({ defaultUnit: z.enum(WEIGHT_UNITS) });

export const DATA_SCHEMAS = {
  exercise: exerciseDataSchema,
  workout: workoutDataSchema,
  workoutExercise: workoutExerciseDataSchema,
  set: setDataSchema,
  settings: settingsDataSchema,
} satisfies Record<Entity, z.ZodType>;

export type ExerciseData = z.infer<typeof exerciseDataSchema>;
export type WorkoutData = z.infer<typeof workoutDataSchema>;
export type WorkoutExerciseData = z.infer<typeof workoutExerciseDataSchema>;
export type SetData = z.infer<typeof setDataSchema>;
export type SettingsData = z.infer<typeof settingsDataSchema>;

// ---- Push ----

export const mutationSchema = z.object({
  /** Idempotency key: a retried mutation with the same id is applied once. */
  id: z.uuid(),
  entity: z.enum(ENTITIES),
  entityId: id,
  op: z.enum(['upsert', 'delete']),
  /** The server version the device's change is based on; 0 = created on the device. */
  baseVersion: z.number().int().min(0),
  /** Full record for an upsert, validated per entity on the server. */
  data: z.unknown().optional(),
});
export type Mutation = z.infer<typeof mutationSchema>;

export const pushRequestSchema = z.object({
  protocol: z.number().int(),
  /** The user the device thinks it is syncing for; the server refuses a mismatch. */
  expectedUserId: id,
  mutations: z.array(mutationSchema).max(PUSH_BATCH_SIZE),
});
export type PushRequest = z.infer<typeof pushRequestSchema>;

export type MutationStatus = 'applied' | 'conflict' | 'rejected';

/**
 * - applied: `row` is the record as stored now (null after a delete).
 * - conflict: the change wasn't applied; `row` is the server's copy (null if
 *   it was deleted). The device keeps its version for the user to review.
 * - rejected: invalid or not allowed; retrying the same change won't help.
 */
export type MutationResult = {
  id: string;
  status: MutationStatus;
  row?: WireRow | null;
  error?: string;
};

export type PushResponse = { results: MutationResult[] };

// ---- Rows (pull, and in mutation results) ----

export type WireExercise = {
  id: string;
  version: number;
  name: string;
  muscleGroup: string | null;
  videoUrl: string | null;
  archived: boolean;
  createdAt: string;
  deletedAt: string | null;
};

export type WireWorkout = {
  id: string;
  version: number;
  startedAt: string;
  endedAt: string | null;
  notes: string | null;
  deletedAt: string | null;
};

export type WireWorkoutExercise = {
  id: string;
  version: number;
  workoutId: string;
  exerciseId: string;
  position: number;
  notes: string | null;
  deletedAt: string | null;
};

export type WireSet = {
  id: string;
  version: number;
  workoutExerciseId: string;
  position: number;
  weight: number | null;
  unit: (typeof WEIGHT_UNITS)[number];
  reps: number | null;
  durationSec: number | null;
  rpe: number | null;
  notes: string | null;
  completedAt: string;
  deletedAt: string | null;
};

export type WireSettings = SettingsData;

export type WireRow = WireExercise | WireWorkout | WireWorkoutExercise | WireSet | WireSettings;

export type SyncUser = { id: string; email: string; name: string; defaultUnit: SettingsData['defaultUnit'] };

export type PullResponse = {
  user: SyncUser;
  exercises: WireExercise[];
  workouts: WireWorkout[];
  workoutExercises: WireWorkoutExercise[];
  sets: WireSet[];
  /** Opaque; pass back as `?cursor=` for the next page or the next sync. */
  cursor: string;
  hasMore: boolean;
};
