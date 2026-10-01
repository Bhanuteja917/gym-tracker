import type { DB } from '@/db/types';
import { createTestDb } from '@/test/test-db';

import { exportBackup, exportCsv, InvalidBackupError, parseBackup, restoreBackup } from './backup';
import { createExercise, listExercises, setExerciseVideoUrl } from './exercises';
import { addFoodEntry } from './food';
import { addMuscleGroup, DEFAULT_MUSCLE_GROUPS, moveMuscleGroup } from './muscle-groups';
import { addPlanExercise, setPlanDayName, updatePlanTargets } from './plan';
import { getDefaultUnit, setDefaultUnit } from './settings';
import {
  addExerciseToSession,
  finishSession,
  getWorkout,
  logSet,
  startPlannedSession,
  startSession,
} from './workouts';

function populate(db: DB) {
  setDefaultUnit(db, 'kg');
  const glutes = addMuscleGroup(db, 'Glutes');
  moveMuscleGroup(db, glutes.id, -1);
  createExercise(db, 'Hip Abduction', 'Glutes');
  const custom = createExercise(db, 'Zercher Squat, "heavy"', 'Legs');
  setExerciseVideoUrl(db, custom.id, 'https://youtu.be/zercher');
  const s = startSession(db, new Date(2026, 8, 1, 18, 0).getTime());
  const se = addExerciseToSession(db, s.id, custom.id);
  logSet(db, se.id, { weight: 100, unit: 'kg', reps: 5, notes: 'felt good' }, s.startedAt + 60_000);
  logSet(db, se.id, { weight: 225, unit: 'lb', reps: 3, rpe: 9 }, s.startedAt + 180_000);
  finishSession(db, s.id, s.startedAt + 3_600_000);

  setPlanDayName(db, 1, 'Legs');
  const pe = addPlanExercise(db, 1, custom.id);
  updatePlanTargets(db, pe.id, { targetSets: 3, targetReps: 5, targetWeight: 100, targetUnit: 'kg' });
  const planned = startPlannedSession(db, 1, new Date(2026, 8, 7, 18, 0).getTime());
  const plannedExercise = getWorkout(db, planned.id)!.exercises[0];
  logSet(db, plannedExercise.id, { weight: 100, unit: 'kg', reps: 5 }, planned.startedAt + 60_000);
  finishSession(db, planned.id, planned.startedAt + 3_600_000);

  addFoodEntry(db, '2026-09-01', { name: 'Shake', calories: 300, protein: 40, carbs: null, fat: 5 }, { saveAsFood: true }, 1000);
  addFoodEntry(db, '2026-09-01', { name: 'Rice', calories: 200, protein: null, carbs: 45, fat: null }, {}, 2000);
}

describe('backup', () => {
  it('round-trips all data through JSON into a fresh database', () => {
    const source = createTestDb();
    populate(source);
    const json = JSON.stringify(exportBackup(source, 42));

    const target = createTestDb();
    const backup = parseBackup(json);
    restoreBackup(target, backup);

    expect(exportBackup(target, 42)).toEqual(exportBackup(source, 42));
    expect(getDefaultUnit(target)).toBe('kg');
  });

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('nope')).toThrow(InvalidBackupError);
    expect(() => parseBackup('{"format":"other"}')).toThrow('Not a Gym Tracker backup file');
    expect(() => parseBackup('{"format":"gym-tracker-backup","version":99}')).toThrow(
      'Unsupported backup version 99',
    );
  });

  it('rejects malformed rows', () => {
    const db = createTestDb();
    populate(db);
    const backup = exportBackup(db);
    (backup.sets[0] as unknown as Record<string, unknown>).unit = 'stone';
    expect(() => parseBackup(JSON.stringify(backup))).toThrow('sets[0].unit is invalid');
  });

  it('includes the weekly plan, food log and planned-workout targets', () => {
    const db = createTestDb();
    populate(db);
    const backup = exportBackup(db);
    expect(backup.version).toBe(4);
    expect(backup.exercises.find((e) => e.videoUrl)?.videoUrl).toBe('https://youtu.be/zercher');
    expect(backup.muscleGroups.map((g) => g.name).slice(-2)).toEqual(['Glutes', 'Full body']);
    expect(backup.planDays).toEqual([{ weekday: 1, name: 'Legs' }]);
    expect(backup.planExercises).toHaveLength(1);
    expect(backup.savedFoods.map((f) => f.name)).toEqual(['Shake']);
    expect(backup.foodEntries.map((f) => f.name)).toEqual(['Shake', 'Rice']);
    expect(backup.sessions.map((s) => s.planWeekday)).toEqual([null, 1]);
    expect(backup.sessionExercises[1]).toMatchObject({ targetSets: 3, targetReps: 5, targetWeight: 100 });
  });

  it('restores a version 1 backup made before the plan and food log', () => {
    const source = createTestDb();
    populate(source);
    const full = exportBackup(source);
    const omit = (row: object, keys: string[]) =>
      Object.fromEntries(Object.entries(row).filter(([k]) => !keys.includes(k)));
    const v1 = {
      ...omit(full, ['planDays', 'planExercises', 'savedFoods', 'foodEntries', 'muscleGroups']),
      version: 1,
      exercises: full.exercises.map((e) => omit(e, ['videoUrl'])),
      sessions: full.sessions.map((s) => omit(s, ['planWeekday'])),
      sessionExercises: full.sessionExercises.map((e) =>
        omit(e, ['targetSets', 'targetReps', 'targetWeight', 'targetUnit']),
      ),
    };

    const target = createTestDb();
    restoreBackup(target, parseBackup(JSON.stringify(v1)));
    const restored = exportBackup(target);
    expect(restored.sets).toEqual(full.sets);
    expect(restored.planDays).toEqual([]);
    expect(restored.planExercises).toEqual([]);
    expect(restored.savedFoods).toEqual([]);
    expect(restored.foodEntries).toEqual([]);
    expect(restored.sessions.every((s) => s.planWeekday === null)).toBe(true);
    expect(restored.sessionExercises.every((e) => e.targetSets === null && e.targetUnit === null)).toBe(true);
  });

  it('restores a version 2 backup made before editable muscle groups', () => {
    const source = createTestDb();
    populate(source);
    const { muscleGroups: _, ...v4 } = exportBackup(source);
    const v3exercises = v4.exercises.map(({ videoUrl: __, ...e }) => e);
    const v2 = { ...v4, version: 2, exercises: v3exercises };

    const target = createTestDb();
    restoreBackup(target, parseBackup(JSON.stringify(v2)));
    const restored = exportBackup(target);
    expect(restored.muscleGroups.map((g) => g.name)).toEqual([...DEFAULT_MUSCLE_GROUPS, 'Glutes']);
    expect(restored.muscleGroups.map((g) => g.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(restored.exercises).toEqual(v4.exercises.map((e) => ({ ...e, videoUrl: null })));
  });

  it('restores a version 3 backup made before video links', () => {
    const source = createTestDb();
    populate(source);
    const full = exportBackup(source);
    const v3 = { ...full, version: 3, exercises: full.exercises.map(({ videoUrl: _, ...e }) => e) };

    const target = createTestDb();
    restoreBackup(target, parseBackup(JSON.stringify(v3)));
    const restored = exportBackup(target);
    expect(restored.exercises.every((e) => e.videoUrl === null)).toBe(true);
    expect(restored.muscleGroups).toEqual(full.muscleGroups);
  });

  it('rejects malformed food entries', () => {
    const db = createTestDb();
    populate(db);
    const backup = exportBackup(db);
    (backup.foodEntries[0] as unknown as Record<string, unknown>).day = '2026-02-30';
    expect(() => parseBackup(JSON.stringify(backup))).toThrow('foodEntries[0].day is invalid');
  });

  it('leaves existing data untouched when a restore fails', () => {
    const db = createTestDb();
    populate(db);
    const before = exportBackup(db, 0);

    const broken = exportBackup(db, 0);
    broken.sets[0].sessionExerciseId = 9999; // dangling reference
    expect(() => restoreBackup(db, broken)).toThrow();
    expect(exportBackup(db, 0)).toEqual(before);
    expect(listExercises(db).length).toBe(before.exercises.length);
  });
});

describe('exportCsv', () => {
  it('writes one escaped row per set', () => {
    const db = createTestDb();
    populate(db);
    const lines = exportCsv(db).trimEnd().split('\n');
    expect(lines[0]).toBe('date,workout_id,exercise,category,set,weight,unit,reps,rpe,notes,completed_at');
    expect(lines).toHaveLength(4);
    expect(lines[1]).toMatch(/^2026-09-01,1,"Zercher Squat, ""heavy""",Legs,1,100,kg,5,,felt good,/);
    expect(lines[2]).toMatch(/^2026-09-01,1,"Zercher Squat, ""heavy""",Legs,2,225,lb,3,9,,/);
    expect(lines[3]).toMatch(/^2026-09-07,2,"Zercher Squat, ""heavy""",Legs,1,100,kg,5,,,/);
  });
});
