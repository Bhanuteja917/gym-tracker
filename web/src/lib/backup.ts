import { z } from 'zod';

import { WEIGHT_UNITS } from './units';

/**
 * Backups exported by the Expo app (Settings → Export backup), versions 1–4.
 * Only workout data is read: settings, exercises, sessions and sets. The
 * weekly plan and food log in newer versions are ignored for now.
 */
export const EXPO_BACKUP_FORMAT = 'gym-tracker-backup';

const int = z.number().int();
const epochMs = z.number().int().nonnegative();

const backupSchema = z.object({
  format: z.literal(EXPO_BACKUP_FORMAT, { error: 'Not a Gym Tracker backup file' }),
  version: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)], {
    error: 'Unsupported backup version',
  }),
  settings: z.array(z.object({ key: z.string(), value: z.string() })).default([]),
  exercises: z.array(
    z.object({
      id: int,
      name: z.string().trim().min(1).max(100),
      category: z.string().nullable().optional(),
      videoUrl: z.string().nullable().optional(),
      archived: z.boolean(),
      createdAt: epochMs,
    }),
  ),
  sessions: z.array(
    z.object({
      id: int,
      startedAt: epochMs,
      endedAt: epochMs.nullable(),
      notes: z.string().nullable(),
    }),
  ),
  sessionExercises: z.array(
    z.object({
      id: int,
      sessionId: int,
      exerciseId: int,
      position: int,
      notes: z.string().nullable(),
    }),
  ),
  sets: z.array(
    z.object({
      id: int,
      sessionExerciseId: int,
      position: int,
      weight: z.number().finite().nullable(),
      unit: z.enum(WEIGHT_UNITS),
      reps: int,
      rpe: z.number().finite().nullable(),
      notes: z.string().nullable(),
      completedAt: epochMs,
    }),
  ),
});

export type ExpoBackup = z.infer<typeof backupSchema>;

export class InvalidBackupError extends Error {}

/** Parses and validates backup JSON. Throws InvalidBackupError with a readable message. */
export function parseExpoBackup(json: string): ExpoBackup {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new InvalidBackupError('File is not valid JSON');
  }
  const result = backupSchema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue?.path.length ? ` (${issue.path.join('.')})` : '';
    throw new InvalidBackupError(`${issue?.message ?? 'Invalid backup'}${where}`);
  }
  const b = result.data;

  const exerciseIds = new Set(b.exercises.map((e) => e.id));
  const sessionIds = new Set(b.sessions.map((s) => s.id));
  const sessionExerciseIds = new Set(b.sessionExercises.map((e) => e.id));
  for (const se of b.sessionExercises) {
    if (!sessionIds.has(se.sessionId) || !exerciseIds.has(se.exerciseId)) {
      throw new InvalidBackupError(`sessionExercises ${se.id} refers to a missing row`);
    }
  }
  for (const s of b.sets) {
    if (!sessionExerciseIds.has(s.sessionExerciseId)) {
      throw new InvalidBackupError(`set ${s.id} refers to a missing row`);
    }
  }
  return b;
}
