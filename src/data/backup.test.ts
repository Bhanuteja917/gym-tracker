import type { DB } from '@/db/types';
import { createTestDb } from '@/test/test-db';

import { exportBackup, exportCsv, InvalidBackupError, parseBackup, restoreBackup } from './backup';
import { createExercise, listExercises } from './exercises';
import { getDefaultUnit, setDefaultUnit } from './settings';
import { addExerciseToSession, finishSession, logSet, startSession } from './workouts';

function populate(db: DB) {
  setDefaultUnit(db, 'kg');
  const custom = createExercise(db, 'Zercher Squat, "heavy"', 'Legs');
  const s = startSession(db, new Date(2026, 8, 1, 18, 0).getTime());
  const se = addExerciseToSession(db, s.id, custom.id);
  logSet(db, se.id, { weight: 100, unit: 'kg', reps: 5, notes: 'felt good' }, s.startedAt + 60_000);
  logSet(db, se.id, { weight: 225, unit: 'lb', reps: 3, rpe: 9 }, s.startedAt + 180_000);
  finishSession(db, s.id, s.startedAt + 3_600_000);
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
    expect(lines).toHaveLength(3);
    expect(lines[1]).toMatch(/^2026-09-01,1,"Zercher Squat, ""heavy""",Legs,1,100,kg,5,,felt good,/);
    expect(lines[2]).toMatch(/^2026-09-01,1,"Zercher Squat, ""heavy""",Legs,2,225,lb,3,9,,/);
  });
});
