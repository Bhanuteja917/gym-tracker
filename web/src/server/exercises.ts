import 'server-only';

import type { ExerciseInput } from '@/lib/validation';

import { prisma } from './db';
import { DomainError, notFound } from './errors';

export const DEFAULT_MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Legs',
  'Core',
  'Full body',
];

const exerciseSelect = {
  id: true,
  name: true,
  muscleGroup: true,
  videoUrl: true,
  archived: true,
} as const;

export type ExerciseSummary = {
  id: string;
  name: string;
  muscleGroup: string | null;
  videoUrl: string | null;
  archived: boolean;
};

export async function listExercises(
  userId: string,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): Promise<ExerciseSummary[]> {
  return prisma.exercise.findMany({
    where: { userId, ...(includeArchived ? {} : { archived: false }) },
    select: exerciseSelect,
    orderBy: { name: 'asc' },
  });
}

export async function getExercise(userId: string, id: string): Promise<ExerciseSummary> {
  const exercise = await prisma.exercise.findFirst({ where: { id, userId }, select: exerciseSelect });
  if (!exercise) throw notFound('Exercise');
  return exercise;
}

/** Default groups first, then any other names in use, without case duplicates. */
export async function listMuscleGroups(userId: string): Promise<string[]> {
  const rows = await prisma.exercise.findMany({
    where: { userId, muscleGroup: { not: null } },
    select: { muscleGroup: true },
    distinct: ['muscleGroup'],
    orderBy: { muscleGroup: 'asc' },
  });
  const names = [...DEFAULT_MUSCLE_GROUPS];
  for (const { muscleGroup } of rows) {
    if (muscleGroup && !names.some((n) => n.toLowerCase() === muscleGroup.toLowerCase())) {
      names.push(muscleGroup);
    }
  }
  return names;
}

async function assertNameFree(userId: string, name: string, exceptId?: string): Promise<void> {
  const clash = await prisma.exercise.findFirst({
    where: {
      userId,
      name: { equals: name, mode: 'insensitive' },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (clash) throw new DomainError(`An exercise named "${name}" already exists`, 'CONFLICT');
}

export async function createExercise(userId: string, input: ExerciseInput): Promise<ExerciseSummary> {
  await assertNameFree(userId, input.name);
  return prisma.exercise.create({ data: { userId, ...input }, select: exerciseSelect });
}

export async function updateExercise(
  userId: string,
  id: string,
  input: ExerciseInput,
): Promise<void> {
  await getExercise(userId, id);
  await assertNameFree(userId, input.name, id);
  await prisma.exercise.update({ where: { id }, data: input });
}

export async function setExerciseArchived(
  userId: string,
  id: string,
  archived: boolean,
): Promise<void> {
  const { count } = await prisma.exercise.updateMany({ where: { id, userId }, data: { archived } });
  if (count === 0) throw notFound('Exercise');
}

/** Deletes an exercise that was never logged. One with history can only be archived. */
export async function deleteExercise(userId: string, id: string): Promise<void> {
  await getExercise(userId, id);
  const used = await prisma.workoutExercise.count({ where: { exerciseId: id } });
  if (used > 0) {
    throw new DomainError('This exercise has history. Archive it instead.', 'CONFLICT');
  }
  await prisma.exercise.delete({ where: { id } });
}
