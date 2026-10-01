import { eq } from 'drizzle-orm';

import { exercises } from '@/db/schema';
import type { DB } from '@/db/types';
import { createTestDb } from '@/test/test-db';

import { addPlanExercise, setPlanDayName, updatePlanTargets } from './plan';
import { setDefaultUnit } from './settings';
import {
  addExerciseToSession,
  finishSession,
  getWorkout,
  logSet,
  startPlannedSession,
  startSession,
  suggestedSetValues,
} from './workouts';

let db: DB;
beforeEach(() => {
  db = createTestDb();
});

function exerciseId(name: string): number {
  return db.select().from(exercises).where(eq(exercises.name, name)).get()!.id;
}

const T0 = new Date(2026, 8, 28, 18, 0).getTime();

function planMonday() {
  setPlanDayName(db, 1, 'Push');
  const bench = addPlanExercise(db, 1, exerciseId('Bench Press'));
  updatePlanTargets(db, bench.id, { targetSets: 3, targetReps: 8, targetWeight: 135, targetUnit: 'lb' });
  addPlanExercise(db, 1, exerciseId('Dip'));
  return bench;
}

describe('startPlannedSession', () => {
  it("copies the day's exercises and targets in order", () => {
    planMonday();
    const session = startPlannedSession(db, 1, T0);
    expect(session.planWeekday).toBe(1);
    const workout = getWorkout(db, session.id)!;
    expect(workout.exercises.map((e) => e.exercise.name)).toEqual(['Bench Press', 'Dip']);
    expect(workout.exercises[0]).toMatchObject({
      targetSets: 3,
      targetReps: 8,
      targetWeight: 135,
      targetUnit: 'lb',
    });
    expect(workout.exercises[1]).toMatchObject({ targetSets: null, targetReps: null, targetWeight: null });
  });

  it('returns the workout already in progress unchanged', () => {
    planMonday();
    const blank = startSession(db, T0);
    const again = startPlannedSession(db, 1, T0 + 1000);
    expect(again.id).toBe(blank.id);
    expect(getWorkout(db, blank.id)!.exercises).toEqual([]);
  });

  it('keeps the snapshotted targets when the plan changes later', () => {
    const bench = planMonday();
    const session = startPlannedSession(db, 1, T0);
    updatePlanTargets(db, bench.id, { targetSets: 5, targetReps: 5, targetWeight: 155, targetUnit: 'lb' });
    expect(getWorkout(db, session.id)!.exercises[0]).toMatchObject({ targetSets: 3, targetWeight: 135 });
  });
});

describe('suggestedSetValues', () => {
  it('uses the targets before any set is logged', () => {
    planMonday();
    const session = startPlannedSession(db, 1, T0);
    const bench = getWorkout(db, session.id)!.exercises[0];
    expect(suggestedSetValues(db, bench.id)).toEqual({ weight: 135, unit: 'lb', reps: 8 });
  });

  it('follows the last set logged in this workout', () => {
    planMonday();
    const session = startPlannedSession(db, 1, T0);
    const bench = getWorkout(db, session.id)!.exercises[0];
    logSet(db, bench.id, { weight: 140, unit: 'lb', reps: 6 }, T0 + 60_000);
    expect(suggestedSetValues(db, bench.id)).toEqual({ weight: 140, unit: 'lb', reps: 6 });
  });

  it('fills fields without a target from the previous workout', () => {
    const earlier = startSession(db, T0 - 7 * 86_400_000);
    const se = addExerciseToSession(db, earlier.id, exerciseId('Bench Press'));
    logSet(db, se.id, { weight: 60, unit: 'kg', reps: 5 }, earlier.startedAt + 60_000);
    finishSession(db, earlier.id, earlier.startedAt + 3_600_000);

    const pe = addPlanExercise(db, 1, exerciseId('Bench Press'));
    updatePlanTargets(db, pe.id, { targetSets: 3, targetReps: 10, targetWeight: null, targetUnit: 'lb' });
    const session = startPlannedSession(db, 1, T0);
    const bench = getWorkout(db, session.id)!.exercises[0];
    expect(suggestedSetValues(db, bench.id)).toEqual({ weight: 60, unit: 'kg', reps: 10 });
  });

  it('falls back to empty fields in the default unit', () => {
    setDefaultUnit(db, 'kg');
    const session = startSession(db, T0);
    const se = addExerciseToSession(db, session.id, exerciseId('Deadlift'));
    expect(suggestedSetValues(db, se.id)).toEqual({ weight: null, unit: 'kg', reps: null });
  });

  it('returns undefined for an unknown exercise entry', () => {
    expect(suggestedSetValues(db, 9999)).toBeUndefined();
  });
});
