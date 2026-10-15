import 'server-only';

import type { SetInput } from '@/lib/validation';

import { prisma } from './db';
import { notFound } from './errors';

/** Logs a set at the end of a workout exercise. Returns the workout id. */
export async function addSet(
  userId: string,
  workoutExerciseId: string,
  input: SetInput,
  now = new Date(),
): Promise<{ id: string; workoutId: string }> {
  return prisma.$transaction(async (tx) => {
    const owner = await tx.workoutExercise.findFirst({
      where: { id: workoutExerciseId, workout: { userId } },
      select: { workoutId: true },
    });
    if (!owner) throw notFound('Exercise');
    const last = await tx.exerciseSet.findFirst({
      where: { workoutExerciseId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const set = await tx.exerciseSet.create({
      data: { workoutExerciseId, position: (last?.position ?? -1) + 1, completedAt: now, ...input },
      select: { id: true },
    });
    return { id: set.id, workoutId: owner.workoutId };
  });
}

async function findOwnedSet(userId: string, setId: string) {
  const set = await prisma.exerciseSet.findFirst({
    where: { id: setId, workoutExercise: { workout: { userId } } },
    select: { workoutExercise: { select: { workoutId: true } } },
  });
  if (!set) throw notFound('Set');
  return { workoutId: set.workoutExercise.workoutId };
}

export async function updateSet(
  userId: string,
  setId: string,
  input: SetInput,
): Promise<{ workoutId: string }> {
  const owner = await findOwnedSet(userId, setId);
  await prisma.exerciseSet.update({ where: { id: setId }, data: input });
  return owner;
}

export async function deleteSet(userId: string, setId: string): Promise<{ workoutId: string }> {
  const owner = await findOwnedSet(userId, setId);
  await prisma.exerciseSet.delete({ where: { id: setId } });
  return owner;
}
