import { eq } from 'drizzle-orm';

import { exercises } from '@/db/schema';
import type { DB } from '@/db/types';
import { createTestDb } from '@/test/test-db';

import {
  createExercise,
  DuplicateExerciseError,
  listExercises,
  removeExercise,
  renameExercise,
} from './exercises';
import { bestSet, getExerciseHistory, getLastPerformance } from './history';
import { getDefaultUnit, setDefaultUnit } from './settings';
import {
  addExerciseToSession,
  deleteSession,
  deleteSet,
  finishSession,
  getActiveSession,
  getWorkout,
  listWorkoutSummaries,
  logSet,
  removeSessionExercise,
  reopenSession,
  startSession,
  updateSet,
} from './workouts';

let db: DB;
beforeEach(() => {
  db = createTestDb();
});

function exerciseId(name: string): number {
  return db.select().from(exercises).where(eq(exercises.name, name)).get()!.id;
}

describe('seed data', () => {
  it('ships a starter exercise list and defaults to pounds', () => {
    expect(listExercises(db).length).toBeGreaterThan(30);
    expect(getDefaultUnit(db)).toBe('lb');
  });
});

describe('settings', () => {
  it('stores the default unit', () => {
    setDefaultUnit(db, 'kg');
    expect(getDefaultUnit(db)).toBe('kg');
    setDefaultUnit(db, 'lb');
    expect(getDefaultUnit(db)).toBe('lb');
  });
});

describe('exercises', () => {
  it('creates with a trimmed name and rejects case-insensitive duplicates', () => {
    const e = createExercise(db, '  Cable   Lateral Raise ', 'Shoulders');
    expect(e.name).toBe('Cable Lateral Raise');
    expect(() => createExercise(db, 'cable lateral raise')).toThrow(DuplicateExerciseError);
    expect(() => createExercise(db, '   ')).toThrow('required');
  });

  it('rejects renaming onto another exercise but allows changing case', () => {
    const id = exerciseId('Bench Press');
    expect(() => renameExercise(db, id, 'deadlift')).toThrow(DuplicateExerciseError);
    expect(renameExercise(db, id, 'bench press').name).toBe('bench press');
  });

  it('deletes unused exercises and archives used ones', () => {
    const unused = createExercise(db, 'Sled Push');
    expect(removeExercise(db, unused.id)).toBe('deleted');

    const session = startSession(db);
    addExerciseToSession(db, session.id, exerciseId('Deadlift'));
    expect(removeExercise(db, exerciseId('Deadlift'))).toBe('archived');
    expect(listExercises(db).map((e) => e.name)).not.toContain('Deadlift');
    expect(listExercises(db, { includeArchived: true }).map((e) => e.name)).toContain('Deadlift');
  });

  it('restores an archived exercise when re-created', () => {
    const e = createExercise(db, 'Good Morning');
    const session = startSession(db);
    addExerciseToSession(db, session.id, e.id);
    removeExercise(db, e.id);
    expect(createExercise(db, 'good morning')).toMatchObject({ id: e.id, archived: false });
  });
});

describe('workouts', () => {
  it('has at most one active workout', () => {
    const a = startSession(db, 1000);
    const b = startSession(db, 2000);
    expect(b.id).toBe(a.id);
    expect(getActiveSession(db)?.id).toBe(a.id);
  });

  it('logs sets in order and loads the full workout', () => {
    const s = startSession(db, 1000);
    const bench = addExerciseToSession(db, s.id, exerciseId('Bench Press'));
    const row = addExerciseToSession(db, s.id, exerciseId('Barbell Row'));
    expect(addExerciseToSession(db, s.id, exerciseId('Bench Press')).id).toBe(bench.id);

    logSet(db, bench.id, { weight: 135, unit: 'lb', reps: 8 }, 2000);
    logSet(db, bench.id, { weight: 60, unit: 'kg', reps: 6, rpe: 8.5, notes: '  paused ' }, 3000);
    logSet(db, row.id, { weight: null, unit: 'lb', reps: 12 }, 4000);

    const w = getWorkout(db, s.id)!;
    expect(w.exercises.map((e) => e.exercise.name)).toEqual(['Bench Press', 'Barbell Row']);
    expect(w.exercises[0].sets).toMatchObject([
      { position: 0, weight: 135, unit: 'lb', reps: 8, rpe: null, notes: null },
      { position: 1, weight: 60, unit: 'kg', reps: 6, rpe: 8.5, notes: 'paused' },
    ]);
    expect(w.exercises[1].sets[0].weight).toBeNull();
  });

  it('updates and deletes sets', () => {
    const s = startSession(db);
    const se = addExerciseToSession(db, s.id, exerciseId('Back Squat'));
    const set = logSet(db, se.id, { weight: 225, unit: 'lb', reps: 5 });
    updateSet(db, set.id, { weight: 100, unit: 'kg', reps: 3 });
    expect(getWorkout(db, s.id)!.exercises[0].sets[0]).toMatchObject({ weight: 100, unit: 'kg', reps: 3 });
    deleteSet(db, set.id);
    expect(getWorkout(db, s.id)!.exercises[0].sets).toEqual([]);
  });

  it('discards an empty workout on finish and keeps one with sets', () => {
    const empty = startSession(db, 1000);
    addExerciseToSession(db, empty.id, exerciseId('Bench Press'));
    expect(finishSession(db, empty.id, 2000)).toBe('discarded');
    expect(getWorkout(db, empty.id)).toBeUndefined();

    const s = startSession(db, 3000);
    const se = addExerciseToSession(db, s.id, exerciseId('Bench Press'));
    logSet(db, se.id, { weight: 135, unit: 'lb', reps: 5 });
    expect(finishSession(db, s.id, 4000)).toBe('finished');
    expect(getWorkout(db, s.id)?.endedAt).toBe(4000);
    expect(getActiveSession(db)).toBeUndefined();
  });

  it('only reopens a workout when no other one is in progress', () => {
    const a = startSession(db, 1000);
    const se = addExerciseToSession(db, a.id, exerciseId('Bench Press'));
    logSet(db, se.id, { weight: 135, unit: 'lb', reps: 5 });
    finishSession(db, a.id, 2000);

    const b = startSession(db, 3000);
    expect(reopenSession(db, a.id)).toBe(false);
    expect(getActiveSession(db)?.id).toBe(b.id);

    finishSession(db, b.id); // empty, so discarded
    expect(reopenSession(db, a.id)).toBe(true);
    expect(getActiveSession(db)?.id).toBe(a.id);
  });

  it('cascades deletes from workouts and workout exercises to sets', () => {
    const s = startSession(db);
    const a = addExerciseToSession(db, s.id, exerciseId('Bench Press'));
    const b = addExerciseToSession(db, s.id, exerciseId('Dip'));
    logSet(db, a.id, { weight: 135, unit: 'lb', reps: 5 });
    logSet(db, b.id, { weight: null, unit: 'lb', reps: 10 });

    removeSessionExercise(db, b.id);
    expect(getWorkout(db, s.id)!.exercises).toHaveLength(1);

    deleteSession(db, s.id);
    expect(listWorkoutSummaries(db)).toEqual([]);
  });

  it('summarizes workouts newest first', () => {
    const first = startSession(db, 1000);
    const se = addExerciseToSession(db, first.id, exerciseId('Deadlift'));
    logSet(db, se.id, { weight: 315, unit: 'lb', reps: 3 });
    logSet(db, se.id, { weight: 315, unit: 'lb', reps: 3 });
    finishSession(db, first.id, 2000);

    const second = startSession(db, 5000);
    addExerciseToSession(db, second.id, exerciseId('Pull-up'));
    addExerciseToSession(db, second.id, exerciseId('Dip'));

    expect(listWorkoutSummaries(db)).toMatchObject([
      { id: second.id, exerciseNames: ['Pull-up', 'Dip'], setCount: 0 },
      { id: first.id, exerciseNames: ['Deadlift'], setCount: 2 },
    ]);
  });
});

describe('history', () => {
  function workout(startedAt: number, name: string, sets: [number | null, number][]) {
    const s = startSession(db, startedAt);
    const se = addExerciseToSession(db, s.id, exerciseId(name));
    sets.forEach(([weight, reps], i) => logSet(db, se.id, { weight, unit: 'lb', reps }, startedAt + i));
    finishSession(db, s.id, startedAt + 100);
    return s.id;
  }

  it('returns previous sessions newest first and "last time" excluding the current one', () => {
    const old = workout(1000, 'Bench Press', [[135, 8]]);
    const recent = workout(2000, 'Bench Press', [[145, 8], [145, 7]]);
    workout(3000, 'Deadlift', [[225, 5]]);
    const current = workout(4000, 'Bench Press', [[150, 5]]);

    expect(getExerciseHistory(db, exerciseId('Bench Press')).map((h) => h.sessionId)).toEqual([
      current,
      recent,
      old,
    ]);
    const last = getLastPerformance(db, exerciseId('Bench Press'), current)!;
    expect(last.sessionId).toBe(recent);
    expect(last.sets.map((s) => s.reps)).toEqual([8, 7]);
    expect(getLastPerformance(db, exerciseId('Leg Press'))).toBeUndefined();
  });
});

describe('bestSet', () => {
  it('compares across units, then by reps, with bodyweight lowest', () => {
    expect(
      bestSet([
        { weight: null, unit: 'lb', reps: 20 },
        { weight: 135, unit: 'lb', reps: 5 },
        { weight: 62, unit: 'kg', reps: 3 }, // 136.7 lb
        { weight: 62, unit: 'kg', reps: 4 },
      ]),
    ).toEqual({ weight: 62, unit: 'kg', reps: 4 });
    expect(bestSet([{ weight: null, unit: 'lb', reps: 10 }])?.reps).toBe(10);
    expect(bestSet([])).toBeUndefined();
  });
});
