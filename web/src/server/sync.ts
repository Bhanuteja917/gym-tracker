import 'server-only';

import { z } from 'zod';

import { isWeightUnit } from '@/lib/units';
import {
  DATA_SCHEMAS,
  type ExerciseData,
  type Mutation,
  type MutationResult,
  type PullResponse,
  type SetData,
  type SettingsData,
  type WireExercise,
  type WireRow,
  type WireSet,
  type WireWorkout,
  type WireWorkoutExercise,
  type WorkoutData,
  type WorkoutExerciseData,
} from '@/lib/sync-protocol';
import { firstError } from '@/lib/validation';

import { prisma } from './db';
import type { Prisma } from '../generated/prisma/client';

type Tx = Prisma.TransactionClient;

/**
 * Runs `fn` in a transaction holding this user's write lock. Every write to a
 * user's synced rows goes through here, so their `seq` values (assigned by the
 * sync_bump trigger) become visible in increasing order and a pull that has
 * seen seq N will never later find a smaller committed seq.
 */
export async function withUserLock<T>(
  userId: string,
  fn: (tx: Tx) => Promise<T>,
  options?: { timeout?: number; maxWait?: number },
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(7311, hashtext(${userId}))`;
    return fn(tx);
  }, options);
}

// ---- Wire mappers (never expose seq or userId) ----

const iso = (d: Date) => d.toISOString();
const isoOrNull = (d: Date | null) => (d ? d.toISOString() : null);

type ExerciseRow = Prisma.ExerciseGetPayload<object>;
type WorkoutRow = Prisma.WorkoutGetPayload<object>;
type WorkoutExerciseRow = Prisma.WorkoutExerciseGetPayload<object>;
type SetRow = Prisma.ExerciseSetGetPayload<object>;

export const toWire = {
  exercise: (r: ExerciseRow): WireExercise => ({
    id: r.id,
    version: r.version,
    name: r.name,
    muscleGroup: r.muscleGroup,
    videoUrl: r.videoUrl,
    archived: r.archived,
    createdAt: iso(r.createdAt),
    deletedAt: isoOrNull(r.deletedAt),
  }),
  workout: (r: WorkoutRow): WireWorkout => ({
    id: r.id,
    version: r.version,
    startedAt: iso(r.startedAt),
    endedAt: isoOrNull(r.endedAt),
    notes: r.notes,
    deletedAt: isoOrNull(r.deletedAt),
  }),
  workoutExercise: (r: WorkoutExerciseRow): WireWorkoutExercise => ({
    id: r.id,
    version: r.version,
    workoutId: r.workoutId,
    exerciseId: r.exerciseId,
    position: r.position,
    notes: r.notes,
    deletedAt: isoOrNull(r.deletedAt),
  }),
  set: (r: SetRow): WireSet => ({
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
    completedAt: iso(r.completedAt),
    deletedAt: isoOrNull(r.deletedAt),
  }),
};

// ---- Push ----

const applied = (m: Mutation, row: WireRow | null): MutationResult => ({ id: m.id, status: 'applied', row });
const conflict = (m: Mutation, row: WireRow | null, error?: string): MutationResult => ({
  id: m.id,
  status: 'conflict',
  row,
  ...(error ? { error } : {}),
});
const rejected = (m: Mutation, error: string): MutationResult => ({ id: m.id, status: 'rejected', error });

/** How long applied mutation ids are remembered for retries. */
const MUTATION_LOG_DAYS = 30;

/**
 * Applies a device's mutations in order, each at most once (by mutation id),
 * and returns one result per mutation. A mutation that fails doesn't stop the
 * others; each runs in its own savepoint.
 */
export async function applyPush(userId: string, mutations: Mutation[]): Promise<MutationResult[]> {
  return withUserLock(
    userId,
    async (tx) => {
      const results: MutationResult[] = [];
      for (const m of mutations) {
        const done = await tx.syncMutation.findUnique({ where: { userId_id: { userId, id: m.id } } });
        if (done) {
          results.push(done.result as MutationResult);
          continue;
        }
        await tx.$executeRaw`SAVEPOINT mutation`;
        try {
          const result = await applyMutation(tx, userId, m);
          await tx.syncMutation.create({
            data: { userId, id: m.id, result: result as unknown as Prisma.InputJsonValue },
          });
          await tx.$executeRaw`RELEASE SAVEPOINT mutation`;
          results.push(result);
        } catch (error) {
          await tx.$executeRaw`ROLLBACK TO SAVEPOINT mutation`;
          console.error('sync: mutation failed', m.entity, m.op, error);
          // Not stored: a retry may succeed.
          results.push({ id: m.id, status: 'rejected', error: 'The server couldn’t save this change' });
        }
      }
      await tx.syncMutation.deleteMany({
        where: { userId, appliedAt: { lt: new Date(Date.now() - MUTATION_LOG_DAYS * 86_400_000) } },
      });
      return results;
    },
    { timeout: 30_000, maxWait: 10_000 },
  );
}

async function applyMutation(tx: Tx, userId: string, m: Mutation): Promise<MutationResult> {
  let data: unknown = undefined;
  if (m.op === 'upsert') {
    const parsed = DATA_SCHEMAS[m.entity].safeParse(m.data);
    if (!parsed.success) return rejected(m, firstError(parsed.error));
    data = parsed.data;
  }
  switch (m.entity) {
    case 'settings':
      if (m.op === 'delete') return rejected(m, 'Settings can’t be deleted');
      return applySettings(tx, userId, m, data as SettingsData);
    case 'exercise':
      return m.op === 'delete' ? deleteExercise(tx, userId, m) : upsertExercise(tx, userId, m, data as ExerciseData);
    case 'workout':
      return m.op === 'delete' ? deleteWorkout(tx, userId, m) : upsertWorkout(tx, userId, m, data as WorkoutData);
    case 'workoutExercise':
      return m.op === 'delete'
        ? deleteWorkoutExercise(tx, userId, m)
        : upsertWorkoutExercise(tx, userId, m, data as WorkoutExerciseData);
    case 'set':
      return m.op === 'delete' ? deleteSet(tx, userId, m) : upsertSet(tx, userId, m, data as SetData);
  }
}

/**
 * The shared version check for an upsert. Returns a result to send back when
 * the change can't be applied as-is, or 'create' / 'update' to proceed.
 */
function checkVersion<R extends { userId: string; version: number; deletedAt: Date | null }>(
  m: Mutation,
  userId: string,
  existing: R | null,
  wire: (r: R) => WireRow,
): MutationResult | 'create' | 'update' {
  // Someone else's id: answer as if it doesn't exist, without revealing it does.
  if (existing && existing.userId !== userId) return rejected(m, 'Not found');
  if (!existing) return m.baseVersion === 0 ? 'create' : conflict(m, null, 'It was deleted on another device');
  if (existing.deletedAt) return conflict(m, null, 'It was deleted on another device');
  if (existing.version !== m.baseVersion) return conflict(m, wire(existing), 'It was changed on another device');
  return 'update';
}

async function applySettings(tx: Tx, userId: string, m: Mutation, data: SettingsData): Promise<MutationResult> {
  // Last write wins: a preference, not a record.
  await tx.user.update({ where: { id: userId }, data: { defaultUnit: data.defaultUnit } });
  return applied(m, { defaultUnit: data.defaultUnit });
}

/** A name not used by another live exercise of this user: "Bench", "Bench (2)", … */
async function freeExerciseName(tx: Tx, userId: string, name: string, exceptId: string): Promise<string> {
  const taken = new Set(
    (
      await tx.exercise.findMany({
        where: { userId, deletedAt: null, id: { not: exceptId }, name: { startsWith: name, mode: 'insensitive' } },
        select: { name: true },
      })
    ).map((e) => e.name.toLowerCase()),
  );
  if (!taken.has(name.toLowerCase())) return name;
  for (let n = 2; ; n++) {
    const candidate = `${name} (${n})`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

async function upsertExercise(tx: Tx, userId: string, m: Mutation, data: ExerciseData): Promise<MutationResult> {
  const existing = await tx.exercise.findUnique({ where: { id: m.entityId } });
  const check = checkVersion(m, userId, existing, toWire.exercise);
  if (typeof check !== 'string') return check;
  // Two devices can create the same name offline; keep both, the second renamed.
  const fields = { ...data, name: await freeExerciseName(tx, userId, data.name, m.entityId) };
  const row =
    check === 'create'
      ? await tx.exercise.create({ data: { id: m.entityId, userId, ...fields } })
      : await tx.exercise.update({ where: { id: m.entityId }, data: fields });
  return applied(m, toWire.exercise(row));
}

async function deleteExercise(tx: Tx, userId: string, m: Mutation): Promise<MutationResult> {
  const existing = await tx.exercise.findFirst({ where: { id: m.entityId, userId } });
  if (!existing || existing.deletedAt) return applied(m, null);
  const used = await tx.workoutExercise.count({ where: { exerciseId: existing.id, deletedAt: null } });
  if (used > 0) return conflict(m, toWire.exercise(existing), 'This exercise has history. Archive it instead.');
  await tx.exercise.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
  return applied(m, null);
}

async function upsertWorkout(tx: Tx, userId: string, m: Mutation, data: WorkoutData): Promise<MutationResult> {
  const existing = await tx.workout.findUnique({ where: { id: m.entityId } });
  const check = checkVersion(m, userId, existing, toWire.workout);
  if (typeof check !== 'string') return check;
  const fields = {
    startedAt: new Date(data.startedAt),
    endedAt: data.endedAt ? new Date(data.endedAt) : null,
    notes: data.notes,
  };
  const row =
    check === 'create'
      ? await tx.workout.create({ data: { id: m.entityId, userId, ...fields } })
      : await tx.workout.update({ where: { id: m.entityId }, data: fields });
  return applied(m, toWire.workout(row));
}

async function deleteWorkout(tx: Tx, userId: string, m: Mutation): Promise<MutationResult> {
  const existing = await tx.workout.findFirst({ where: { id: m.entityId, userId, deletedAt: null } });
  if (!existing) return applied(m, null);
  // A deletion wins over edits made elsewhere, and takes the workout's contents with it.
  const deletedAt = new Date();
  await tx.exerciseSet.updateMany({
    where: { userId, deletedAt: null, workoutExercise: { workoutId: existing.id } },
    data: { deletedAt },
  });
  await tx.workoutExercise.updateMany({ where: { userId, workoutId: existing.id, deletedAt: null }, data: { deletedAt } });
  await tx.workout.update({ where: { id: existing.id }, data: { deletedAt } });
  return applied(m, null);
}

async function upsertWorkoutExercise(
  tx: Tx,
  userId: string,
  m: Mutation,
  data: WorkoutExerciseData,
): Promise<MutationResult> {
  const existing = await tx.workoutExercise.findUnique({ where: { id: m.entityId } });
  const check = checkVersion(m, userId, existing, toWire.workoutExercise);
  if (typeof check !== 'string') return check;
  const [workout, exercise] = await Promise.all([
    tx.workout.findFirst({ where: { id: data.workoutId, userId }, select: { deletedAt: true } }),
    tx.exercise.findFirst({ where: { id: data.exerciseId, userId }, select: { deletedAt: true } }),
  ]);
  if (!workout) return rejected(m, 'Workout not found');
  if (!exercise) return rejected(m, 'Exercise not found');
  if (workout.deletedAt) return conflict(m, null, 'The workout was deleted on another device');
  if (exercise.deletedAt) return conflict(m, null, 'The exercise was deleted on another device');
  const row =
    check === 'create'
      ? await tx.workoutExercise.create({ data: { id: m.entityId, userId, ...data } })
      : await tx.workoutExercise.update({ where: { id: m.entityId }, data });
  return applied(m, toWire.workoutExercise(row));
}

async function deleteWorkoutExercise(tx: Tx, userId: string, m: Mutation): Promise<MutationResult> {
  const existing = await tx.workoutExercise.findFirst({ where: { id: m.entityId, userId, deletedAt: null } });
  if (!existing) return applied(m, null);
  const deletedAt = new Date();
  await tx.exerciseSet.updateMany({ where: { userId, workoutExerciseId: existing.id, deletedAt: null }, data: { deletedAt } });
  await tx.workoutExercise.update({ where: { id: existing.id }, data: { deletedAt } });
  return applied(m, null);
}

async function upsertSet(tx: Tx, userId: string, m: Mutation, data: SetData): Promise<MutationResult> {
  const existing = await tx.exerciseSet.findUnique({ where: { id: m.entityId } });
  const check = checkVersion(m, userId, existing, toWire.set);
  if (typeof check !== 'string') return check;
  const parent = await tx.workoutExercise.findFirst({
    where: { id: data.workoutExerciseId, userId },
    select: { deletedAt: true },
  });
  if (!parent) return rejected(m, 'Exercise not found');
  if (parent.deletedAt) return conflict(m, null, 'The exercise was removed from the workout on another device');
  const fields = { ...data, completedAt: new Date(data.completedAt) };
  const row =
    check === 'create'
      ? await tx.exerciseSet.create({ data: { id: m.entityId, userId, ...fields } })
      : await tx.exerciseSet.update({ where: { id: m.entityId }, data: fields });
  return applied(m, toWire.set(row));
}

async function deleteSet(tx: Tx, userId: string, m: Mutation): Promise<MutationResult> {
  await tx.exerciseSet.updateMany({
    where: { id: m.entityId, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  return applied(m, null);
}

// ---- Pull ----

export const cursorSchema = z
  .string()
  .regex(/^\d{1,19}$/)
  .transform((s) => BigInt(s));

/**
 * The user's rows changed after `cursor` (tombstones included), oldest change
 * first, up to `limit` per table. Reads one snapshot so the four tables agree.
 */
export async function pullChanges(userId: string, cursor: bigint, limit = 500): Promise<PullResponse> {
  return prisma.$transaction(
    async (tx) => {
      const where = { userId, seq: { gt: cursor } };
      const page = { orderBy: { seq: 'asc' as const }, take: limit };
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { id: true, email: true, name: true, defaultUnit: true },
      });
      const exercises = await tx.exercise.findMany({ where, ...page });
      const workouts = await tx.workout.findMany({ where, ...page });
      const workoutExercises = await tx.workoutExercise.findMany({ where, ...page });
      const sets = await tx.exerciseSet.findMany({ where, ...page });

      // A full page may have more rows after it, so the cursor can only move to
      // the lowest last-seq among full pages; rows past that come next time.
      const tables = [exercises, workouts, workoutExercises, sets];
      const full = tables.filter((t) => t.length === limit);
      const upTo = full.length
        ? full.map((t) => t.at(-1)!.seq).reduce((a, b) => (a < b ? a : b))
        : tables.flat().reduce((max, r) => (r.seq > max ? r.seq : max), cursor);
      const keep = <R extends { seq: bigint }>(rows: R[]) => rows.filter((r) => r.seq <= upTo);

      return {
        user: { ...user, defaultUnit: isWeightUnit(user.defaultUnit) ? user.defaultUnit : 'lb' },
        exercises: keep(exercises).map(toWire.exercise),
        workouts: keep(workouts).map(toWire.workout),
        workoutExercises: keep(workoutExercises).map(toWire.workoutExercise),
        sets: keep(sets).map(toWire.set),
        cursor: upTo.toString(),
        hasMore: full.length > 0,
      };
    },
    { isolationLevel: 'RepeatableRead' },
  );
}
