import { beforeEach, describe, expect, it } from 'vitest';

import { createUser, hasTestDb, resetDb } from '../../test/db';
import { exerciseInputSchema } from '@/lib/validation';
import { musclesFor } from '@/lib/muscles';

import { prisma } from './db';
import { importExerciseLibrary, LIBRARY } from './exercise-library';

describe('exercise library', () => {
  it('has valid, unique exercises whose muscle groups show on the body figure', () => {
    const names = new Set(LIBRARY.map((e) => e.name.toLowerCase()));
    expect(names.size).toBe(LIBRARY.length);
    for (const e of LIBRARY) {
      expect(exerciseInputSchema.safeParse({ ...e, videoUrl: null }).success).toBe(true);
      expect(musclesFor(e.muscleGroup, e.name), e.name).not.toEqual([]);
    }
  });
});

describe.skipIf(!hasTestDb)('importExerciseLibrary (database)', () => {
  beforeEach(resetDb);

  it('adds missing exercises once, keeping ones the user already has', async () => {
    const user = await createUser();
    const other = await createUser();
    await prisma.exercise.create({
      data: { userId: user.id, name: 'barbell squat', muscleGroup: 'Legs', archived: true },
    });

    const first = await importExerciseLibrary(user.id);
    expect(first).toEqual({ created: LIBRARY.length - 1, skipped: 1 });
    expect(await importExerciseLibrary(user.id)).toEqual({ created: 0, skipped: LIBRARY.length });

    const squats = await prisma.exercise.findMany({
      where: { userId: user.id, name: { equals: 'Barbell Squat', mode: 'insensitive' } },
    });
    expect(squats).toHaveLength(1);
    expect(squats[0]).toMatchObject({ muscleGroup: 'Legs', archived: true });
    expect(await prisma.exercise.count({ where: { userId: user.id } })).toBe(LIBRARY.length);
    expect(await prisma.exercise.count({ where: { userId: other.id } })).toBe(0);
    // Inserted rows get a sync sequence number, so devices pull them.
    expect(await prisma.exercise.count({ where: { userId: user.id, seq: 0 } })).toBe(0);
  });
});
