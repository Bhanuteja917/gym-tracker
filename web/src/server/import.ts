import 'server-only';

import { randomUUID } from 'node:crypto';

import type { ExpoBackup } from '@/lib/backup';
import { parseDayKey } from '@/lib/dot-grid';
import { isAttendanceRange } from '@/lib/settings';
import { isWeightUnit } from '@/lib/units';

import { withUserLock } from './sync';

export type ImportResult = {
  exercisesCreated: number;
  workoutsImported: number;
  setsImported: number;
  workoutsSkipped: number;
};

/**
 * Merges an Expo app backup into the user's data:
 * - exercises are matched by name (case-insensitive) and created when missing;
 * - each workout with sets is imported, except one that starts at exactly the
 *   same time as an existing workout, so importing the same file twice is safe;
 * - a workout still in progress in the backup is imported as finished.
 * Everything happens in one transaction under the user's sync write lock;
 * devices pick the new rows up on their next sync.
 */
export async function importExpoBackup(userId: string, backup: ExpoBackup): Promise<ImportResult> {
  const setsBySessionExercise = Map.groupBy(backup.sets, (s) => s.sessionExerciseId);
  const exercisesBySession = Map.groupBy(
    backup.sessionExercises.filter((se) => setsBySessionExercise.has(se.id)),
    (se) => se.sessionId,
  );
  const sessions = backup.sessions.filter((s) => exercisesBySession.has(s.id));

  return withUserLock(
    userId,
    async (tx) => {
      // Exercises: map backup ids to this user's exercise ids.
      const existing = await tx.exercise.findMany({
        where: { userId, deletedAt: null },
        select: { id: true, name: true },
      });
      const idByName = new Map(existing.map((e) => [e.name.toLowerCase(), e.id]));
      const exerciseId = new Map<number, string>();
      const newExercises = [];
      for (const e of backup.exercises) {
        const key = e.name.trim().toLowerCase();
        let id = idByName.get(key);
        if (!id) {
          id = randomUUID();
          idByName.set(key, id);
          newExercises.push({
            id,
            userId,
            name: e.name.trim(),
            muscleGroup: e.category?.trim() || null,
            videoUrl: e.videoUrl?.trim() || null,
            archived: e.archived,
            createdAt: new Date(e.createdAt),
          });
        }
        exerciseId.set(e.id, id);
      }
      await tx.exercise.createMany({ data: newExercises });

      // Workouts, skipping ones already imported.
      const taken = new Set(
        (
          await tx.workout.findMany({
            where: {
              userId,
              deletedAt: null,
              startedAt: { in: sessions.map((s) => new Date(s.startedAt)) },
            },
            select: { startedAt: true },
          })
        ).map((w) => w.startedAt.getTime()),
      );

      const workouts = [];
      const workoutExercises = [];
      const sets = [];
      for (const s of sessions) {
        if (taken.has(s.startedAt)) continue;
        const workoutId = randomUUID();
        let lastSetAt = s.startedAt;
        for (const se of exercisesBySession.get(s.id)!) {
          const workoutExerciseId = randomUUID();
          workoutExercises.push({
            id: workoutExerciseId,
            userId,
            workoutId,
            exerciseId: exerciseId.get(se.exerciseId)!,
            position: se.position,
            notes: se.notes,
          });
          for (const set of setsBySessionExercise.get(se.id)!) {
            lastSetAt = Math.max(lastSetAt, set.completedAt);
            sets.push({
              userId,
              workoutExerciseId,
              position: set.position,
              weight: set.weight,
              unit: set.unit,
              reps: set.reps,
              rpe: set.rpe,
              notes: set.notes,
              completedAt: new Date(set.completedAt),
            });
          }
        }
        workouts.push({
          id: workoutId,
          userId,
          startedAt: new Date(s.startedAt),
          endedAt: new Date(s.endedAt ?? lastSetAt),
          notes: s.notes,
        });
      }
      await tx.workout.createMany({ data: workouts });
      await tx.workoutExercise.createMany({ data: workoutExercises });
      await tx.exerciseSet.createMany({ data: sets });

      const setting = (key: string) => backup.settings.find((s) => s.key === key)?.value;
      const unit = setting('default_unit');
      const range = setting('attendance_range');
      const start = setting('attendance_start');
      await tx.user.update({
        where: { id: userId },
        data: {
          ...(isWeightUnit(unit) && { defaultUnit: unit }),
          ...(isAttendanceRange(range) && { attendanceRange: range }),
          ...(start && parseDayKey(start) && { attendanceStart: start }),
        },
      });

      return {
        exercisesCreated: newExercises.length,
        workoutsImported: workouts.length,
        setsImported: sets.length,
        workoutsSkipped: sessions.length - workouts.length,
      };
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
}
