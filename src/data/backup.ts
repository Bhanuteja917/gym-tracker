import { asc, eq } from 'drizzle-orm';

import {
  exercises,
  foodEntries,
  planDays,
  planExercises,
  savedFoods,
  sessionExercises,
  sessions,
  setEntries,
  settings,
  WEIGHT_UNITS,
  type Exercise,
  type FoodEntry,
  type PlanDayRow,
  type PlanExercise,
  type SavedFood,
  type Session,
  type SessionExercise,
  type SetEntry,
} from '@/db/schema';
import type { DB } from '@/db/types';
import { isWeekday } from '@/lib/days';
import { parseDayKey } from '@/lib/dot-grid';

export const BACKUP_FORMAT = 'gym-tracker-backup';
export const BACKUP_VERSION = 2;

export type Backup = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: number;
  settings: { key: string; value: string }[];
  exercises: Exercise[];
  sessions: Session[];
  sessionExercises: SessionExercise[];
  sets: SetEntry[];
  planDays: PlanDayRow[];
  planExercises: PlanExercise[];
  savedFoods: SavedFood[];
  foodEntries: FoodEntry[];
};

export function exportBackup(db: DB, now = Date.now()): Backup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now,
    settings: db.select().from(settings).all(),
    exercises: db.select().from(exercises).orderBy(asc(exercises.id)).all(),
    sessions: db.select().from(sessions).orderBy(asc(sessions.id)).all(),
    sessionExercises: db.select().from(sessionExercises).orderBy(asc(sessionExercises.id)).all(),
    sets: db.select().from(setEntries).orderBy(asc(setEntries.id)).all(),
    planDays: db.select().from(planDays).orderBy(asc(planDays.weekday)).all(),
    planExercises: db.select().from(planExercises).orderBy(asc(planExercises.id)).all(),
    savedFoods: db.select().from(savedFoods).orderBy(asc(savedFoods.id)).all(),
    foodEntries: db.select().from(foodEntries).orderBy(asc(foodEntries.id)).all(),
  };
}

// ---- Import ---------------------------------------------------------------

export class InvalidBackupError extends Error {}

type Check = (v: unknown) => boolean;
const isInt: Check = (v) => Number.isInteger(v);
const isNum: Check = (v) => typeof v === 'number' && Number.isFinite(v);
const isStr: Check = (v) => typeof v === 'string';
const isBool: Check = (v) => typeof v === 'boolean';
const isUnit: Check = (v) => WEIGHT_UNITS.includes(v as never);
const nullable =
  (check: Check): Check =>
  (v) =>
    v === null || check(v);

function checkRows(value: unknown, name: string, shape: Record<string, Check>): void {
  if (!Array.isArray(value)) throw new InvalidBackupError(`"${name}" is missing`);
  value.forEach((row, i) => {
    if (typeof row !== 'object' || row === null) {
      throw new InvalidBackupError(`${name}[${i}] is not an object`);
    }
    for (const [key, check] of Object.entries(shape)) {
      if (!check((row as Record<string, unknown>)[key])) {
        throw new InvalidBackupError(`${name}[${i}].${key} is invalid`);
      }
    }
  });
}

/** Version 1 predates the weekly plan and food log: add empty tables and null columns. */
function upgradeV1(b: Record<string, unknown>): void {
  if (Array.isArray(b.sessions)) {
    b.sessions = b.sessions.map((s: object) => ({ planWeekday: null, ...s }));
  }
  if (Array.isArray(b.sessionExercises)) {
    b.sessionExercises = b.sessionExercises.map((e: object) => ({
      targetSets: null,
      targetReps: null,
      targetWeight: null,
      targetUnit: null,
      ...e,
    }));
  }
  b.planDays = [];
  b.planExercises = [];
  b.savedFoods = [];
  b.foodEntries = [];
  b.version = BACKUP_VERSION;
}

/** Parses and validates backup JSON. Throws InvalidBackupError with a readable message. */
export function parseBackup(json: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new InvalidBackupError('File is not valid JSON');
  }
  if (typeof data !== 'object' || data === null) throw new InvalidBackupError('Not a backup file');
  const b = data as Record<string, unknown>;
  if (b.format !== BACKUP_FORMAT) throw new InvalidBackupError('Not a Gym Tracker backup file');
  if (b.version === 1) upgradeV1(b);
  if (b.version !== BACKUP_VERSION) {
    throw new InvalidBackupError(`Unsupported backup version ${String(b.version)}`);
  }

  checkRows(b.settings, 'settings', { key: isStr, value: isStr });
  checkRows(b.exercises, 'exercises', {
    id: isInt,
    name: isStr,
    category: nullable(isStr),
    archived: isBool,
    createdAt: isInt,
  });
  checkRows(b.sessions, 'sessions', {
    id: isInt,
    startedAt: isInt,
    endedAt: nullable(isInt),
    notes: nullable(isStr),
    planWeekday: nullable((v) => isInt(v) && isWeekday(v as number)),
  });
  checkRows(b.sessionExercises, 'sessionExercises', {
    id: isInt,
    sessionId: isInt,
    exerciseId: isInt,
    position: isInt,
    notes: nullable(isStr),
    targetSets: nullable(isInt),
    targetReps: nullable(isInt),
    targetWeight: nullable(isNum),
    targetUnit: nullable(isUnit),
  });
  checkRows(b.sets, 'sets', {
    id: isInt,
    sessionExerciseId: isInt,
    position: isInt,
    weight: nullable(isNum),
    unit: isUnit,
    reps: isInt,
    rpe: nullable(isNum),
    notes: nullable(isStr),
    completedAt: isInt,
  });
  checkRows(b.planDays, 'planDays', {
    weekday: (v) => isInt(v) && isWeekday(v as number),
    name: nullable(isStr),
  });
  checkRows(b.planExercises, 'planExercises', {
    id: isInt,
    weekday: isInt,
    exerciseId: isInt,
    position: isInt,
    targetSets: nullable(isInt),
    targetReps: nullable(isInt),
    targetWeight: nullable(isNum),
    targetUnit: isUnit,
  });
  checkRows(b.savedFoods, 'savedFoods', {
    id: isInt,
    name: isStr,
    calories: isInt,
    protein: nullable(isNum),
    carbs: nullable(isNum),
    fat: nullable(isNum),
  });
  checkRows(b.foodEntries, 'foodEntries', {
    id: isInt,
    day: (v) => isStr(v) && parseDayKey(v as string) !== null,
    loggedAt: isInt,
    name: isStr,
    calories: isInt,
    protein: nullable(isNum),
    carbs: nullable(isNum),
    fat: nullable(isNum),
  });
  return data as Backup;
}

function chunks<T>(rows: T[], size = 200): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

/**
 * Replaces all data with the backup's contents in one transaction.
 * If anything fails (e.g. a broken reference), nothing is changed.
 */
export function restoreBackup(db: DB, backup: Backup): void {
  db.transaction((tx) => {
    tx.delete(foodEntries).run();
    tx.delete(savedFoods).run();
    tx.delete(planExercises).run();
    tx.delete(planDays).run();
    tx.delete(setEntries).run();
    tx.delete(sessionExercises).run();
    tx.delete(sessions).run();
    tx.delete(exercises).run();
    tx.delete(settings).run();

    for (const c of chunks(backup.settings)) tx.insert(settings).values(c).run();
    for (const c of chunks(backup.exercises)) tx.insert(exercises).values(c).run();
    for (const c of chunks(backup.sessions)) tx.insert(sessions).values(c).run();
    for (const c of chunks(backup.sessionExercises)) tx.insert(sessionExercises).values(c).run();
    for (const c of chunks(backup.sets)) tx.insert(setEntries).values(c).run();
    for (const c of chunks(backup.planDays)) tx.insert(planDays).values(c).run();
    for (const c of chunks(backup.planExercises)) tx.insert(planExercises).values(c).run();
    for (const c of chunks(backup.savedFoods)) tx.insert(savedFoods).values(c).run();
    for (const c of chunks(backup.foodEntries)) tx.insert(foodEntries).values(c).run();
  });
}

// ---- CSV ------------------------------------------------------------------

const CSV_HEADER = [
  'date',
  'workout_id',
  'exercise',
  'category',
  'set',
  'weight',
  'unit',
  'reps',
  'rpe',
  'notes',
  'completed_at',
];

/** YYYY-MM-DD in the phone's time zone. */
function localDate(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function csvCell(value: string | number | null): string {
  if (value === null) return '';
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One row per set, oldest first — handy for spreadsheets. */
export function exportCsv(db: DB): string {
  const rows = db
    .select({
      startedAt: sessions.startedAt,
      sessionId: sessions.id,
      exercise: exercises.name,
      category: exercises.category,
      position: setEntries.position,
      weight: setEntries.weight,
      unit: setEntries.unit,
      reps: setEntries.reps,
      rpe: setEntries.rpe,
      notes: setEntries.notes,
      completedAt: setEntries.completedAt,
    })
    .from(setEntries)
    .innerJoin(sessionExercises, eq(setEntries.sessionExerciseId, sessionExercises.id))
    .innerJoin(sessions, eq(sessionExercises.sessionId, sessions.id))
    .innerJoin(exercises, eq(sessionExercises.exerciseId, exercises.id))
    .orderBy(asc(sessions.startedAt), asc(sessionExercises.position), asc(setEntries.position))
    .all();

  // Sets are numbered 1..n within each exercise, independent of stored positions.
  const setNumbers = new Map<string, number>();
  const lines = rows.map((r) => {
    const key = `${r.sessionId}:${r.exercise}`;
    const n = (setNumbers.get(key) ?? 0) + 1;
    setNumbers.set(key, n);
    return [
      localDate(r.startedAt),
      r.sessionId,
      r.exercise,
      r.category,
      n,
      r.weight,
      r.unit,
      r.reps,
      r.rpe,
      r.notes,
      new Date(r.completedAt).toISOString(),
    ]
      .map(csvCell)
      .join(',');
  });
  return [CSV_HEADER.join(','), ...lines].join('\n') + '\n';
}
