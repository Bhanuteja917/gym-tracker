import { asc, eq } from 'drizzle-orm';

import {
  exercises,
  sessionExercises,
  sessions,
  setEntries,
  settings,
  WEIGHT_UNITS,
  type Exercise,
  type Session,
  type SessionExercise,
  type SetEntry,
} from '@/db/schema';
import type { DB } from '@/db/types';

export const BACKUP_FORMAT = 'gym-tracker-backup';
export const BACKUP_VERSION = 1;

export type Backup = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: number;
  settings: { key: string; value: string }[];
  exercises: Exercise[];
  sessions: Session[];
  sessionExercises: SessionExercise[];
  sets: SetEntry[];
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
  };
}

// ---- Import ---------------------------------------------------------------

export class InvalidBackupError extends Error {}

type Check = (v: unknown) => boolean;
const isInt: Check = (v) => Number.isInteger(v);
const isNum: Check = (v) => typeof v === 'number' && Number.isFinite(v);
const isStr: Check = (v) => typeof v === 'string';
const isBool: Check = (v) => typeof v === 'boolean';
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
  });
  checkRows(b.sessionExercises, 'sessionExercises', {
    id: isInt,
    sessionId: isInt,
    exerciseId: isInt,
    position: isInt,
    notes: nullable(isStr),
  });
  checkRows(b.sets, 'sets', {
    id: isInt,
    sessionExerciseId: isInt,
    position: isInt,
    weight: nullable(isNum),
    unit: (v) => WEIGHT_UNITS.includes(v as never),
    reps: isInt,
    rpe: nullable(isNum),
    notes: nullable(isStr),
    completedAt: isInt,
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
