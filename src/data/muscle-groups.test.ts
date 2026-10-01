import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import * as schema from '@/db/schema';
import type { DB } from '@/db/types';
import { createTestDb } from '@/test/test-db';

import { createExercise, getExercise, setExerciseCategory } from './exercises';
import {
  addMuscleGroup,
  countExercisesInGroup,
  DEFAULT_MUSCLE_GROUPS,
  listMuscleGroups,
  moveMuscleGroup,
  removeMuscleGroup,
  renameMuscleGroup,
} from './muscle-groups';

let db: DB;
beforeEach(() => {
  db = createTestDb();
});

const names = () => listMuscleGroups(db).map((g) => g.name);
const group = (name: string) => listMuscleGroups(db).find((g) => g.name === name)!;

describe('muscle groups', () => {
  it('ships the default groups in order', () => {
    expect(names()).toEqual([...DEFAULT_MUSCLE_GROUPS]);
  });

  it('adds trimmed names at the end and rejects blanks and duplicates', () => {
    expect(addMuscleGroup(db, '  Glutes ').name).toBe('Glutes');
    expect(names().at(-1)).toBe('Glutes');
    expect(() => addMuscleGroup(db, 'glutes')).toThrow('already exists');
    expect(() => addMuscleGroup(db, '  ')).toThrow('required');
  });

  it('renames a group and the exercises tagged with it', () => {
    const e = createExercise(db, 'Preacher Curl', 'Arms');
    renameMuscleGroup(db, group('Arms').id, 'Biceps');
    expect(names()).toContain('Biceps');
    expect(getExercise(db, e.id)!.category).toBe('Biceps');
    expect(() => renameMuscleGroup(db, group('Biceps').id, 'legs')).toThrow('already exists');
    // Changing only the case is allowed.
    renameMuscleGroup(db, group('Biceps').id, 'biceps');
    expect(getExercise(db, e.id)!.category).toBe('biceps');
  });

  it('moves groups up and down, stopping at the ends', () => {
    moveMuscleGroup(db, group('Back').id, -1);
    expect(names().slice(0, 2)).toEqual(['Back', 'Chest']);
    moveMuscleGroup(db, group('Back').id, -1);
    expect(names()[0]).toBe('Back');
    moveMuscleGroup(db, group('Full body').id, 1);
    expect(names().at(-1)).toBe('Full body');
  });

  it('deletes a group and clears it from exercises without deleting them', () => {
    const e = createExercise(db, 'Treadmill', 'Cardio');
    expect(countExercisesInGroup(db, group('Cardio').id)).toBe(1);
    removeMuscleGroup(db, group('Cardio').id);
    expect(names()).not.toContain('Cardio');
    expect(getExercise(db, e.id)!.category).toBeNull();
  });

  it('only lets exercises use existing groups, storing the group spelling', () => {
    addMuscleGroup(db, 'Glutes');
    expect(createExercise(db, 'Hip Abduction', 'glutes').category).toBe('Glutes');
    expect(() => createExercise(db, 'Neck Curl', 'Neck')).toThrow('Unknown muscle group');
    const e = createExercise(db, 'Plank');
    expect(setExerciseCategory(db, e.id, 'core').category).toBe('Core');
  });
});

describe('muscle group migration', () => {
  it('keeps group names that existing exercises already use', () => {
    const sqlite = new Database(':memory:');
    const legacy = drizzle(sqlite, { schema });
    const folder = path.join(__dirname, '../../drizzle');
    // Apply migrations up to 0002, add custom categories, then finish migrating.
    const journal = JSON.parse(fs.readFileSync(path.join(folder, 'meta/_journal.json'), 'utf8'));
    const partial = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-'));
    fs.mkdirSync(path.join(partial, 'meta'));
    const early = journal.entries.filter((e: { idx: number }) => e.idx <= 2);
    fs.writeFileSync(
      path.join(partial, 'meta/_journal.json'),
      JSON.stringify({ ...journal, entries: early }),
    );
    for (const e of early) {
      fs.copyFileSync(path.join(folder, `${e.tag}.sql`), path.join(partial, `${e.tag}.sql`));
    }
    migrate(legacy, { migrationsFolder: partial });
    sqlite
      .prepare('INSERT INTO exercise (name, category, created_at) VALUES (?, ?, 0), (?, ?, 0)')
      .run('Hip Abduction', 'glutes', 'Neck Curl', ' Neck ');
    migrate(legacy, { migrationsFolder: folder });

    const after = listMuscleGroups(legacy).map((g) => g.name);
    expect(after).toEqual([...DEFAULT_MUSCLE_GROUPS, 'glutes', 'Neck']);
  });
});
