/**
 * Applying the server's answers to the on-device database: pulled changes and
 * push results. The rule throughout: a record with a change still queued on
 * this device keeps the device's version until that change is answered.
 */
import type {
  MutationResult,
  PullResponse,
  WireExercise,
  WireRow,
  WireSet,
  WireSettings,
  WireWorkout,
  WireWorkoutExercise,
} from '@/lib/sync-protocol';

import { toSettings } from '@/lib/settings';

import { type GymDB, type OutboxEntry, setMeta, storeSettings } from './db';
import { entriesFor, fromWire, type SyncedEntity, TABLE_OF } from './outbox';

const tables = (db: GymDB) => [db.exercises, db.workouts, db.workoutExercises, db.sets, db.outbox, db.conflicts, db.meta];

async function queuedKeys(db: GymDB): Promise<Set<string>> {
  return new Set((await db.outbox.toArray()).map((e) => `${e.entity}:${e.entityId}`));
}

/** Writes the server's copy of a record, unless the device already has a newer one. */
async function putServerRow(db: GymDB, entity: SyncedEntity, row: WireRow): Promise<void> {
  const table = db.table(TABLE_OF[entity]);
  const r = row as { id: string; version: number };
  const local = (await table.get(r.id)) as { version: number } | undefined;
  if (local && local.version > r.version) return;
  switch (entity) {
    case 'exercise':
      return void (await db.exercises.put(fromWire.exercise(row as WireExercise)));
    case 'workout':
      return void (await db.workouts.put(fromWire.workout(row as WireWorkout)));
    case 'workoutExercise':
      return void (await db.workoutExercises.put(fromWire.workoutExercise(row as WireWorkoutExercise)));
    case 'set':
      return void (await db.sets.put(fromWire.set(row as WireSet)));
  }
}

/**
 * Removes a record deleted on the server, with the contents the server
 * deleted along with it, and their queued changes (they can no longer apply).
 */
async function removeLocally(db: GymDB, entity: SyncedEntity, id: string): Promise<void> {
  let exerciseIds: string[] = [];
  let setIds: string[] = [];
  if (entity === 'workout') exerciseIds = await db.workoutExercises.where('workoutId').equals(id).primaryKeys();
  if (entity === 'workoutExercise') exerciseIds = [id];
  if (exerciseIds.length) setIds = await db.sets.where('workoutExerciseId').anyOf(exerciseIds).primaryKeys();
  if (entity === 'set') setIds = [id];

  const keys = [
    ...setIds.map((s) => ['set', s]),
    ...exerciseIds.map((w) => ['workoutExercise', w]),
    [entity, id],
  ] as [string, string][];
  await db.outbox.where('[entity+entityId]').anyOf(keys).delete();
  await db.sets.bulkDelete(setIds);
  await db.workoutExercises.bulkDelete(exerciseIds);
  await db.table(TABLE_OF[entity]).delete(id);
}

/** Applies one page from /api/sync/pull and stores its cursor. */
export async function applyPullPage(db: GymDB, page: PullResponse): Promise<void> {
  await db.transaction('rw', tables(db), async () => {
    const queued = await queuedKeys(db);
    const apply = async (entity: SyncedEntity, rows: (WireRow & { id: string; deletedAt: string | null })[]) => {
      for (const row of rows) {
        if (queued.has(`${entity}:${row.id}`)) continue;
        if (row.deletedAt) await db.table(TABLE_OF[entity]).delete(row.id);
        else await putServerRow(db, entity, row);
      }
    };
    await apply('exercise', page.exercises);
    await apply('workout', page.workouts);
    await apply('workoutExercise', page.workoutExercises);
    await apply('set', page.sets);
    if (!queued.has('settings:settings')) await storeSettings(db, toSettings(page.user));
    await setMeta(db, 'pullCursor', page.cursor);
  });
}

/** Applies the results of a push for the entries that were sent. */
export async function applyPushResults(db: GymDB, sent: OutboxEntry[], results: MutationResult[]): Promise<void> {
  const byId = new Map(results.map((r) => [r.id, r]));
  await db.transaction('rw', tables(db), async () => {
    for (const entry of sent) {
      const result = byId.get(entry.mutationId);
      // No answer, or discarded meanwhile: it stays queued (or gone) as is.
      if (!result || !(await db.outbox.get(entry.seq!))) continue;

      if (result.status === 'rejected') {
        await db.outbox.update(entry.seq!, { status: 'failed', error: result.error ?? 'Rejected by the server' });
        continue;
      }
      await db.outbox.delete(entry.seq!);
      const later = await entriesFor(db, entry.entity, entry.entityId).toArray();

      if (entry.entity === 'settings') {
        if (result.status === 'applied' && later.length === 0 && result.row) {
          await storeSettings(db, toSettings(result.row as WireSettings));
        }
        continue;
      }
      const entity = entry.entity;

      if (result.status === 'applied') {
        const row = result.row as (WireRow & { version: number }) | null | undefined;
        if (later.length > 0) {
          // Newer changes made meanwhile wait to be sent: base them on the version just stored.
          if (row) {
            for (const e of later) await db.outbox.update(e.seq!, { baseVersion: row.version });
            await db.table(TABLE_OF[entity]).update(entry.entityId, { version: row.version });
          }
        } else if (row) {
          // Picks up anything the server adjusted, e.g. a renamed duplicate exercise.
          await putServerRow(db, entity, row);
        }
        continue;
      }

      // Conflict: keep what this device tried to save so the user can review it,
      // and show the server's copy. Later changes were based on the same stale copy.
      const local = later.at(-1) ?? entry;
      await db.conflicts.add({
        entity,
        entityId: entry.entityId,
        local: local.op === 'upsert' ? (local.data ?? null) : null,
        server: result.row ?? null,
        message: result.error ?? 'It was changed on another device',
        createdAt: new Date(),
      });
      await db.outbox.bulkDelete(later.map((e) => e.seq!));
      if (result.row) {
        await db.table(TABLE_OF[entity]).delete(entry.entityId);
        await putServerRow(db, entity, result.row);
      } else {
        await removeLocally(db, entity, entry.entityId);
      }
    }
  });
}
