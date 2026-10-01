import { eq } from 'drizzle-orm';

import { exercises } from '@/db/schema';
import type { DB } from '@/db/types';
import { createTestDb } from '@/test/test-db';

import { createExercise, removeExercise } from './exercises';
import {
  addPlanExercise,
  clearPlanDay,
  describePlanDay,
  getPlanDay,
  getPlanExercise,
  getWeekPlan,
  movePlanExercise,
  removePlanExercise,
  setPlanDayName,
  updatePlanTargets,
} from './plan';
import { setDefaultUnit } from './settings';

let db: DB;
beforeEach(() => {
  db = createTestDb();
});

function exerciseId(name: string): number {
  return db.select().from(exercises).where(eq(exercises.name, name)).get()!.id;
}

const names = (weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7) =>
  getPlanDay(db, weekday).exercises.map((e) => e.exercise.name);

describe('weekly plan', () => {
  it('starts as seven empty rest days, Monday first', () => {
    const week = getWeekPlan(db);
    expect(week.map((d) => d.weekday)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(week.every((d) => d.name === null && d.exercises.length === 0)).toBe(true);
    expect(describePlanDay(week[0])).toBe('Rest day');
  });

  it('names a day, trimming and clearing blanks', () => {
    setPlanDayName(db, 1, '  Push ');
    expect(getPlanDay(db, 1).name).toBe('Push');
    setPlanDayName(db, 1, '   ');
    expect(getPlanDay(db, 1).name).toBeNull();
  });

  it('adds exercises in order with no targets and the default unit', () => {
    setDefaultUnit(db, 'kg');
    addPlanExercise(db, 1, exerciseId('Bench Press'));
    addPlanExercise(db, 1, exerciseId('Barbell Row'));
    expect(names(1)).toEqual(['Bench Press', 'Barbell Row']);
    const first = getPlanDay(db, 1).exercises[0];
    expect(first).toMatchObject({
      targetSets: null,
      targetReps: null,
      targetWeight: null,
      targetUnit: 'kg',
    });
    expect(describePlanDay(getPlanDay(db, 1))).toBe('Workout · 2 exercises');
    setPlanDayName(db, 1, 'Push');
    expect(describePlanDay(getPlanDay(db, 1))).toBe('Push · 2 exercises');
  });

  it('returns the existing entry when an exercise is added twice', () => {
    const a = addPlanExercise(db, 2, exerciseId('Deadlift'));
    const b = addPlanExercise(db, 2, exerciseId('Deadlift'));
    expect(b.id).toBe(a.id);
    expect(names(2)).toEqual(['Deadlift']);
  });

  it('keeps days independent', () => {
    addPlanExercise(db, 1, exerciseId('Bench Press'));
    addPlanExercise(db, 3, exerciseId('Back Squat'));
    expect(names(1)).toEqual(['Bench Press']);
    expect(names(3)).toEqual(['Back Squat']);
    expect(getWeekPlan(db).map((d) => d.exercises.length)).toEqual([1, 0, 1, 0, 0, 0, 0]);
  });

  it('updates targets', () => {
    const pe = addPlanExercise(db, 1, exerciseId('Bench Press'));
    updatePlanTargets(db, pe.id, { targetSets: 3, targetReps: 8, targetWeight: 135, targetUnit: 'lb' });
    expect(getPlanExercise(db, pe.id)).toMatchObject({
      targetSets: 3,
      targetReps: 8,
      targetWeight: 135,
      targetUnit: 'lb',
      exercise: { name: 'Bench Press' },
    });
  });

  it('moves exercises up and down, ignoring moves past either end', () => {
    const a = addPlanExercise(db, 1, exerciseId('Bench Press'));
    addPlanExercise(db, 1, exerciseId('Barbell Row'));
    const c = addPlanExercise(db, 1, exerciseId('Deadlift'));
    movePlanExercise(db, c.id, -1);
    expect(names(1)).toEqual(['Bench Press', 'Deadlift', 'Barbell Row']);
    movePlanExercise(db, a.id, 1);
    expect(names(1)).toEqual(['Deadlift', 'Bench Press', 'Barbell Row']);
    movePlanExercise(db, getPlanDay(db, 1).exercises[0].id, -1);
    expect(names(1)).toEqual(['Deadlift', 'Bench Press', 'Barbell Row']);
  });

  it('removes one exercise or clears the whole day', () => {
    const a = addPlanExercise(db, 1, exerciseId('Bench Press'));
    addPlanExercise(db, 1, exerciseId('Barbell Row'));
    setPlanDayName(db, 1, 'Push');
    removePlanExercise(db, a.id);
    expect(names(1)).toEqual(['Barbell Row']);
    clearPlanDay(db, 1);
    expect(getPlanDay(db, 1)).toEqual({ weekday: 1, name: null, exercises: [] });
  });

  it('drops an exercise from the plan when an unused exercise is deleted', () => {
    const custom = createExercise(db, 'Cossack Squat');
    addPlanExercise(db, 4, custom.id);
    expect(removeExercise(db, custom.id)).toBe('deleted');
    expect(getPlanDay(db, 4).exercises).toEqual([]);
  });
});
