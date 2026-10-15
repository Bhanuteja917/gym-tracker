import 'server-only';

import type { WeightUnit } from '@/lib/units';

import { prisma } from './db';
import { DomainError, notFound } from './errors';

export type SetRow = {
  id: string;
  position: number;
  weight: number | null;
  unit: WeightUnit;
  reps: number;
  rpe: number | null;
  notes: string | null;
  completedAt: Date;
};

export type WorkoutExerciseRow = {
  id: string;
  position: number;
  notes: string | null;
  exercise: { id: string; name: string; muscleGroup: string | null; videoUrl: string | null };
  sets: SetRow[];
};

export type WorkoutDetail = {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
  notes: string | null;
  exercises: WorkoutExerciseRow[];
};

export type WorkoutSummary = {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
  exercises: {
    name: string;
    sets: { weight: number | null; unit: WeightUnit; reps: number }[];
  }[];
};

const setSelect = {
  id: true,
  position: true,
  weight: true,
  unit: true,
  reps: true,
  rpe: true,
  notes: true,
  completedAt: true,
} as const;

export async function getWorkout(userId: string, id: string): Promise<WorkoutDetail> {
  const workout = await prisma.workout.findFirst({
    where: { id, userId },
    select: {
      id: true,
      startedAt: true,
      endedAt: true,
      notes: true,
      exercises: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          position: true,
          notes: true,
          exercise: { select: { id: true, name: true, muscleGroup: true, videoUrl: true } },
          sets: { orderBy: { position: 'asc' }, select: setSelect },
        },
      },
    },
  });
  if (!workout) throw notFound('Workout');
  return workout;
}

/** The workout in progress, if any. There is at most one. */
export async function getActiveWorkout(userId: string): Promise<{ id: string; startedAt: Date } | null> {
  return prisma.workout.findFirst({
    where: { userId, endedAt: null },
    select: { id: true, startedAt: true },
    orderBy: { startedAt: 'desc' },
  });
}

/** Starts a workout, or returns the one already in progress. */
export async function startWorkout(userId: string, now = new Date()): Promise<{ id: string }> {
  return prisma.$transaction(
    async (tx) => {
      const active = await tx.workout.findFirst({
        where: { userId, endedAt: null },
        select: { id: true },
      });
      if (active) return active;
      return tx.workout.create({ data: { userId, startedAt: now }, select: { id: true } });
    },
    { isolationLevel: 'Serializable' },
  );
}

/**
 * Finishes a workout. A workout with no sets is discarded instead, so an
 * accidental "Start" leaves nothing behind.
 */
export async function finishWorkout(
  userId: string,
  id: string,
  now = new Date(),
): Promise<{ discarded: boolean }> {
  const workout = await prisma.workout.findFirst({
    where: { id, userId },
    select: { endedAt: true, _count: { select: { exercises: { where: { sets: { some: {} } } } } } },
  });
  if (!workout) throw notFound('Workout');
  if (workout._count.exercises === 0) {
    await prisma.workout.delete({ where: { id } });
    return { discarded: true };
  }
  if (workout.endedAt === null) {
    await prisma.workout.update({ where: { id }, data: { endedAt: now } });
  }
  return { discarded: false };
}

/** Reopens a finished workout for logging. Refused while another is in progress. */
export async function resumeWorkout(userId: string, id: string): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      const workout = await tx.workout.findFirst({ where: { id, userId }, select: { endedAt: true } });
      if (!workout) throw notFound('Workout');
      if (workout.endedAt === null) return;
      const other = await tx.workout.findFirst({
        where: { userId, endedAt: null },
        select: { id: true },
      });
      if (other) throw new DomainError('Finish the workout in progress first', 'CONFLICT');
      await tx.workout.update({ where: { id }, data: { endedAt: null } });
    },
    { isolationLevel: 'Serializable' },
  );
}

export async function deleteWorkout(userId: string, id: string): Promise<void> {
  const { count } = await prisma.workout.deleteMany({ where: { id, userId } });
  if (count === 0) throw notFound('Workout');
}

export async function updateWorkoutNotes(
  userId: string,
  id: string,
  notes: string | null,
): Promise<void> {
  const { count } = await prisma.workout.updateMany({ where: { id, userId }, data: { notes } });
  if (count === 0) throw notFound('Workout');
}

/** Adds an exercise (the user's own) to the end of a workout. */
export async function addExerciseToWorkout(
  userId: string,
  workoutId: string,
  exerciseId: string,
): Promise<{ id: string }> {
  return prisma.$transaction(async (tx) => {
    const [workout, exercise] = await Promise.all([
      tx.workout.findFirst({ where: { id: workoutId, userId }, select: { id: true } }),
      tx.exercise.findFirst({ where: { id: exerciseId, userId }, select: { id: true } }),
    ]);
    if (!workout) throw notFound('Workout');
    if (!exercise) throw notFound('Exercise');
    const last = await tx.workoutExercise.findFirst({
      where: { workoutId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return tx.workoutExercise.create({
      data: { workoutId, exerciseId, position: (last?.position ?? -1) + 1 },
      select: { id: true },
    });
  });
}

/** Removes an exercise and its sets from a workout. Returns the workout id. */
export async function removeWorkoutExercise(
  userId: string,
  workoutExerciseId: string,
): Promise<{ workoutId: string }> {
  const row = await prisma.workoutExercise.findFirst({
    where: { id: workoutExerciseId, workout: { userId } },
    select: { workoutId: true },
  });
  if (!row) throw notFound('Exercise');
  await prisma.workoutExercise.delete({ where: { id: workoutExerciseId } });
  return row;
}

/** Finished workouts, newest first, `limit` at a time. Pass the last id as `cursor` for more. */
export async function listWorkouts(
  userId: string,
  { limit = 20, cursor }: { limit?: number; cursor?: string } = {},
): Promise<{ workouts: WorkoutSummary[]; nextCursor: string | null }> {
  const rows = await prisma.workout.findMany({
    where: { userId, endedAt: { not: null } },
    orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      startedAt: true,
      endedAt: true,
      exercises: {
        orderBy: { position: 'asc' },
        select: {
          exercise: { select: { name: true } },
          sets: { orderBy: { position: 'asc' }, select: { weight: true, unit: true, reps: true } },
        },
      },
    },
  });
  const workouts = rows.slice(0, limit).map((w) => ({
    ...w,
    exercises: w.exercises.map((e) => ({ name: e.exercise.name, sets: e.sets })),
  }));
  return { workouts, nextCursor: rows.length > limit ? workouts.at(-1)!.id : null };
}

/** Start times of finished workouts since `since`, for the attendance strip. */
export async function listWorkoutDates(userId: string, since: Date): Promise<Date[]> {
  const rows = await prisma.workout.findMany({
    where: { userId, endedAt: { not: null }, startedAt: { gte: since } },
    select: { startedAt: true },
    orderBy: { startedAt: 'asc' },
  });
  return rows.map((r) => r.startedAt);
}
