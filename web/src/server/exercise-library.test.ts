import { beforeEach, describe, expect, it } from 'vitest';

import { createUser, hasTestDb, resetDb } from '../../test/db';
import { exerciseInputSchema } from '@/lib/validation';
import { musclesFor } from '@/lib/muscles';

import { prisma } from './db';
import { CORRECTED, DROPPED, importExerciseLibrary, LIBRARY } from './exercise-library';

describe('exercise library', () => {
  it('has valid, unique exercises whose muscle groups show on the body figure', () => {
    const names = new Set(LIBRARY.map((e) => e.name.toLowerCase()));
    expect(names.size).toBe(LIBRARY.length);
    for (const e of LIBRARY) {
      expect(exerciseInputSchema.safeParse({ ...e, videoUrl: null }).success).toBe(true);
      // Cardio has no muscle group; everything else shows on the figure.
      if (e.muscleGroup !== null) expect(musclesFor(e.muscleGroup, e.name), e.name).not.toEqual([]);
    }
    for (const { after } of CORRECTED) expect(names.has(after.name.toLowerCase()), after.name).toBe(true);
    for (const e of DROPPED) expect(names.has(e.name.toLowerCase()), e.name).toBe(false);
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
    expect(first).toEqual({ created: LIBRARY.length - 1, skipped: 1, corrected: 0, hidden: 0 });
    expect(await importExerciseLibrary(user.id)).toEqual({
      created: 0,
      skipped: LIBRARY.length,
      corrected: 0,
      hidden: 0,
    });

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

  it('corrects exercises imported from an earlier library, leaving edited and logged ones alone', async () => {
    const user = await createUser();
    const add = (name: string, muscleGroup: string | null) =>
      prisma.exercise.create({ data: { userId: user.id, name, muscleGroup } });
    // As an earlier library imported them.
    const airBike = await add('Air Bike', 'Abdominals'); // renamed "Bicycle Crunch"
    const sumo = await add('Sumo Deadlift', 'Hamstrings'); // regrouped
    const edited = await add('Mountain Climbers', 'Core'); // the user changed the group
    const roller = await add('Hamstring-SMR', 'Hamstrings'); // dropped, never logged
    const dip = await add('Parallel Bar Dip', 'Triceps'); // dropped, but logged
    const workout = await prisma.workout.create({ data: { userId: user.id, startedAt: new Date() } });
    await prisma.workoutExercise.create({
      data: { userId: user.id, workoutId: workout.id, exerciseId: dip.id, position: 0 },
    });

    const result = await importExerciseLibrary(user.id);
    expect(result).toMatchObject({ corrected: 2, hidden: 1 });
    const get = (id: string) => prisma.exercise.findUniqueOrThrow({ where: { id } });
    expect(await get(airBike.id)).toMatchObject({ name: 'Bicycle Crunch', muscleGroup: 'Abdominals', version: 2 });
    expect(await get(sumo.id)).toMatchObject({ name: 'Sumo Deadlift', muscleGroup: 'Glutes, Quads' });
    expect(await get(edited.id)).toMatchObject({ muscleGroup: 'Core' });
    expect(await get(roller.id)).toMatchObject({ archived: true });
    expect(await get(dip.id)).toMatchObject({ archived: false });
    // No duplicate "Bicycle Crunch" was created next to the renamed one.
    expect(await prisma.exercise.count({ where: { userId: user.id, name: 'Bicycle Crunch' } })).toBe(1);
    expect(await importExerciseLibrary(user.id)).toMatchObject({ created: 0, corrected: 0, hidden: 0 });
  });
});
