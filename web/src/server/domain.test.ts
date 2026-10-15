import { beforeEach, describe, expect, it } from 'vitest';

import { createUser, hasTestDb, resetDb } from '../../test/db';
import { sampleBackup } from '../../test/fixtures';
import { parseExpoBackup } from '@/lib/backup';

import { prisma } from './db';
import {
  createExercise,
  deleteExercise,
  getExercise,
  listExercises,
  listMuscleGroups,
  setExerciseArchived,
  updateExercise,
} from './exercises';
import { getExerciseHistory, getLastPerformances } from './history';
import { importExpoBackup } from './import';
import { addSet, deleteSet, updateSet } from './sets';
import { getDefaultUnit } from './settings';
import {
  addExerciseToWorkout,
  deleteWorkout,
  finishWorkout,
  getActiveWorkout,
  getWorkout,
  listWorkouts,
  removeWorkoutExercise,
  resumeWorkout,
  startWorkout,
} from './workouts';

const set = (weight: number | null, reps: number) => ({
  weight,
  unit: 'lb' as const,
  reps,
  rpe: null,
  notes: null,
});
const exercise = (name: string, muscleGroup: string | null = null) => ({
  name,
  muscleGroup,
  videoUrl: null,
});

describe.skipIf(!hasTestDb)('domain (database)', () => {
  beforeEach(resetDb);

  describe('exercises', () => {
    it('keeps names unique per user, ignoring case', async () => {
      const a = await createUser();
      const b = await createUser();
      await createExercise(a.id, exercise('Squat'));
      await expect(createExercise(a.id, exercise('squat'))).rejects.toThrow('already exists');
      await expect(createExercise(b.id, exercise('Squat'))).resolves.toBeDefined();
    });

    it('allows renaming to a different case of the same name', async () => {
      const a = await createUser();
      const e = await createExercise(a.id, exercise('squat'));
      await updateExercise(a.id, e.id, exercise('Squat', 'Legs'));
      expect((await getExercise(a.id, e.id)).name).toBe('Squat');
    });

    it('hides archived exercises from the list', async () => {
      const a = await createUser();
      const e = await createExercise(a.id, exercise('Dips'));
      await setExerciseArchived(a.id, e.id, true);
      expect(await listExercises(a.id)).toEqual([]);
      expect(await listExercises(a.id, { includeArchived: true })).toHaveLength(1);
    });

    it('deletes unused exercises but not ones with history', async () => {
      const a = await createUser();
      const unused = await createExercise(a.id, exercise('Unused'));
      await deleteExercise(a.id, unused.id);

      const used = await createExercise(a.id, exercise('Used'));
      const w = await startWorkout(a.id);
      await addExerciseToWorkout(a.id, w.id, used.id);
      await expect(deleteExercise(a.id, used.id)).rejects.toThrow('Archive it instead');
    });

    it('suggests default muscle groups plus ones in use', async () => {
      const a = await createUser();
      await createExercise(a.id, exercise('Calf raise', 'Calves'));
      await createExercise(a.id, exercise('Bench', 'chest'));
      const groups = await listMuscleGroups(a.id);
      expect(groups).toContain('Calves');
      expect(groups.filter((g) => g.toLowerCase() === 'chest')).toHaveLength(1);
    });
  });

  describe('workouts', () => {
    it('logs a workout end to end', async () => {
      const a = await createUser();
      const bench = await createExercise(a.id, exercise('Bench'));
      const w = await startWorkout(a.id);
      const we = await addExerciseToWorkout(a.id, w.id, bench.id);
      await addSet(a.id, we.id, set(135, 8));
      const second = await addSet(a.id, we.id, set(145, 6));
      await updateSet(a.id, second.id, set(145, 5));

      const detail = await getWorkout(a.id, w.id);
      expect(detail.exercises[0]!.sets.map((s) => [s.weight, s.reps, s.position])).toEqual([
        [135, 8, 0],
        [145, 5, 1],
      ]);

      expect(await finishWorkout(a.id, w.id)).toEqual({ discarded: false });
      expect(await getActiveWorkout(a.id)).toBeNull();
      expect((await listWorkouts(a.id)).workouts).toHaveLength(1);
    });

    it('keeps at most one workout in progress', async () => {
      const a = await createUser();
      const first = await startWorkout(a.id);
      expect(await startWorkout(a.id)).toEqual(first);
    });

    it('discards a workout finished without sets', async () => {
      const a = await createUser();
      const e = await createExercise(a.id, exercise('Row'));
      const w = await startWorkout(a.id);
      await addExerciseToWorkout(a.id, w.id, e.id);
      expect(await finishWorkout(a.id, w.id)).toEqual({ discarded: true });
      await expect(getWorkout(a.id, w.id)).rejects.toThrow('not found');
    });

    it('refuses to resume a finished workout while another is in progress', async () => {
      const a = await createUser();
      const e = await createExercise(a.id, exercise('Row'));
      const w1 = await startWorkout(a.id);
      const we = await addExerciseToWorkout(a.id, w1.id, e.id);
      await addSet(a.id, we.id, set(100, 5));
      await finishWorkout(a.id, w1.id);
      await startWorkout(a.id);
      await expect(resumeWorkout(a.id, w1.id)).rejects.toThrow('Finish the workout in progress');
    });

    it('pages through history newest first', async () => {
      const a = await createUser();
      const e = await createExercise(a.id, exercise('Row'));
      for (let day = 1; day <= 3; day++) {
        const w = await startWorkout(a.id, new Date(2026, 0, day));
        const we = await addExerciseToWorkout(a.id, w.id, e.id);
        await addSet(a.id, we.id, set(100 + day, 5));
        await finishWorkout(a.id, w.id);
      }
      const page1 = await listWorkouts(a.id, { limit: 2 });
      expect(page1.workouts.map((w) => w.startedAt.getDate())).toEqual([3, 2]);
      const page2 = await listWorkouts(a.id, { limit: 2, cursor: page1.nextCursor! });
      expect(page2.workouts.map((w) => w.startedAt.getDate())).toEqual([1]);
      expect(page2.nextCursor).toBeNull();
    });

    it('shows last time from other workouts only', async () => {
      const a = await createUser();
      const e = await createExercise(a.id, exercise('Squat'));
      const w1 = await startWorkout(a.id, new Date(2026, 0, 1));
      const we1 = await addExerciseToWorkout(a.id, w1.id, e.id);
      await addSet(a.id, we1.id, set(225, 5));
      await finishWorkout(a.id, w1.id);

      const w2 = await startWorkout(a.id, new Date(2026, 0, 3));
      const we2 = await addExerciseToWorkout(a.id, w2.id, e.id);
      await addSet(a.id, we2.id, set(235, 5));

      const last = await getLastPerformances(a.id, [e.id], w2.id);
      expect(last[e.id]!.workoutId).toBe(w1.id);
      expect(last[e.id]!.sets[0]!.weight).toBe(225);
      expect(await getExerciseHistory(a.id, e.id)).toHaveLength(2);
    });
  });

  describe('isolation between users', () => {
    it("never reads or changes another user's data", async () => {
      const owner = await createUser('Owner');
      const intruder = await createUser('Intruder');
      const e = await createExercise(owner.id, exercise('Deadlift'));
      const w = await startWorkout(owner.id);
      const we = await addExerciseToWorkout(owner.id, w.id, e.id);
      const s = await addSet(owner.id, we.id, set(315, 3));

      const them = intruder.id;
      await expect(getWorkout(them, w.id)).rejects.toThrow('not found');
      await expect(getExercise(them, e.id)).rejects.toThrow('not found');
      await expect(updateExercise(them, e.id, exercise('Hacked'))).rejects.toThrow('not found');
      await expect(setExerciseArchived(them, e.id, true)).rejects.toThrow('not found');
      await expect(deleteExercise(them, e.id)).rejects.toThrow('not found');
      await expect(addSet(them, we.id, set(1, 1))).rejects.toThrow('not found');
      await expect(updateSet(them, s.id, set(1, 1))).rejects.toThrow('not found');
      await expect(deleteSet(them, s.id)).rejects.toThrow('not found');
      await expect(removeWorkoutExercise(them, we.id)).rejects.toThrow('not found');
      await expect(finishWorkout(them, w.id)).rejects.toThrow('not found');
      await expect(resumeWorkout(them, w.id)).rejects.toThrow('not found');
      await expect(deleteWorkout(them, w.id)).rejects.toThrow('not found');
      expect(await getActiveWorkout(them)).toBeNull();
      expect(await getExerciseHistory(them, e.id)).toEqual([]);
      expect(await listExercises(them)).toEqual([]);

      // Their own workout can't reference someone else's exercise.
      const theirs = await startWorkout(them);
      await expect(addExerciseToWorkout(them, theirs.id, e.id)).rejects.toThrow('not found');
      await expect(addExerciseToWorkout(owner.id, theirs.id, e.id)).rejects.toThrow('not found');

      // The owner's data is untouched.
      const detail = await getWorkout(owner.id, w.id);
      expect(detail.exercises[0]!.sets.map((x) => x.weight)).toEqual([315]);
      expect((await getExercise(owner.id, e.id)).name).toBe('Deadlift');
    });
  });

  describe('import', () => {
    it('imports an Expo backup and is safe to repeat', async () => {
      const a = await createUser();
      await createExercise(a.id, exercise('bench press'));
      const backup = parseExpoBackup(JSON.stringify(sampleBackup()));

      expect(await importExpoBackup(a.id, backup)).toEqual({
        exercisesCreated: 1, // "Bench Press" matched the existing exercise
        workoutsImported: 1, // the session without sets is skipped
        setsImported: 3,
        workoutsSkipped: 0,
      });
      expect(await getDefaultUnit(a.id)).toBe('kg');

      const { workouts } = await listWorkouts(a.id);
      const detail = await getWorkout(a.id, workouts[0]!.id);
      expect(detail.exercises.map((e) => e.exercise.name)).toEqual(['bench press', 'Pull-up']);
      expect(detail.exercises[0]!.sets.map((s) => s.weight)).toEqual([60, 62.5]);
      expect(detail.exercises[1]!.sets[0]!.weight).toBeNull();

      expect(await importExpoBackup(a.id, backup)).toMatchObject({
        exercisesCreated: 0,
        workoutsImported: 0,
        workoutsSkipped: 1,
      });
      expect(await prisma.workout.count({ where: { userId: a.id } })).toBe(1);
    });

    it('imports an in-progress session as finished', async () => {
      const a = await createUser();
      const raw = sampleBackup();
      raw.sessions[0]!.endedAt = null;
      const result = await importExpoBackup(a.id, parseExpoBackup(JSON.stringify(raw)));
      expect(result.workoutsImported).toBe(1);
      expect(await getActiveWorkout(a.id)).toBeNull();
    });
  });
});
