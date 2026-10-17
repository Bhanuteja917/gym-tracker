import { randomUUID } from 'node:crypto';

import { beforeEach, describe, expect, it } from 'vitest';

import { createUser, hasTestDb, resetDb } from '../../test/db';
import { EMPTY_PLAN } from '@/lib/plan';
import type { Entity, Mutation, PullResponse } from '@/lib/sync-protocol';

import { prisma } from './db';
import { applyPush, pullChanges } from './sync';

const mut = (
  entity: Entity,
  entityId: string,
  data: unknown,
  { baseVersion = 0, op = 'upsert' as Mutation['op'] } = {},
): Mutation => ({ id: randomUUID(), entity, entityId, op, baseVersion, data });

const exercise = (name: string) => ({ name, muscleGroup: null, videoUrl: null, archived: false });
const workout = (startedAt = '2026-10-01T10:00:00.000Z', endedAt: string | null = null) => ({
  startedAt,
  endedAt,
  notes: null,
});
const set = (workoutExerciseId: string, position: number, weight: number | null, reps: number) => ({
  workoutExerciseId,
  position,
  weight,
  unit: 'lb',
  reps,
  durationSec: null,
  rpe: null,
  notes: null,
  completedAt: '2026-10-01T10:05:00.000Z',
});

/** Creates exercise → workout → workout exercise → one set, as a device would. */
async function logWorkout(userId: string) {
  const ids = { exercise: randomUUID(), workout: randomUUID(), we: randomUUID(), set: randomUUID() };
  const results = await applyPush(userId, [
    mut('exercise', ids.exercise, exercise('Bench Press')),
    mut('workout', ids.workout, workout()),
    mut('workoutExercise', ids.we, { workoutId: ids.workout, exerciseId: ids.exercise, position: 0, notes: null }),
    mut('set', ids.set, set(ids.we, 0, 135, 8)),
  ]);
  expect(results.map((r) => r.status)).toEqual(['applied', 'applied', 'applied', 'applied']);
  return ids;
}

async function pullAll(userId: string, cursor = 0n, limit?: number) {
  const pages: PullResponse[] = [];
  for (;;) {
    const page = await pullChanges(userId, cursor, limit);
    pages.push(page);
    cursor = BigInt(page.cursor);
    if (!page.hasMore) break;
  }
  return {
    cursor,
    exercises: pages.flatMap((p) => p.exercises),
    workouts: pages.flatMap((p) => p.workouts),
    workoutExercises: pages.flatMap((p) => p.workoutExercises),
    sets: pages.flatMap((p) => p.sets),
  };
}

describe.skipIf(!hasTestDb)('sync (database)', () => {
  beforeEach(resetDb);

  it('applies a workout logged on a device and returns it on pull', async () => {
    const a = await createUser();
    const ids = await logWorkout(a.id);

    const first = await pullAll(a.id);
    expect(first.workouts).toMatchObject([{ id: ids.workout, version: 1, endedAt: null, deletedAt: null }]);
    expect(first.sets).toMatchObject([{ id: ids.set, weight: 135, reps: 8, unit: 'lb', version: 1 }]);
    expect(first.exercises.map((e) => e.name)).toEqual(['Bench Press']);

    // Nothing new since the cursor.
    const again = await pullChanges(a.id, first.cursor);
    expect([...again.exercises, ...again.workouts, ...again.workoutExercises, ...again.sets]).toEqual([]);
    expect(again.cursor).toBe(first.cursor.toString());
  });

  it('applies a retried mutation only once', async () => {
    const a = await createUser();
    const workoutId = randomUUID();
    const create = mut('workout', workoutId, workout());
    const finish = mut('workout', workoutId, workout(undefined, '2026-10-01T11:00:00.000Z'), { baseVersion: 1 });

    const first = await applyPush(a.id, [create, finish]);
    // The response was lost; the device sends the same batch again.
    const retry = await applyPush(a.id, [create, finish]);

    expect(retry).toEqual(first);
    expect(first.map((r) => r.status)).toEqual(['applied', 'applied']);
    const row = await prisma.workout.findUniqueOrThrow({ where: { id: workoutId } });
    expect(row.version).toBe(2);
    expect(await prisma.workout.count()).toBe(1);
  });

  it('reports a conflict when the record changed since the device last saw it', async () => {
    const a = await createUser();
    const { set: setId, we } = await logWorkout(a.id);

    // Device 1 edits version 1 → version 2.
    const d1 = await applyPush(a.id, [mut('set', setId, set(we, 0, 140, 8), { baseVersion: 1 })]);
    expect(d1[0]).toMatchObject({ status: 'applied', row: { version: 2, weight: 140 } });

    // Device 2 also edited version 1: not applied, gets the server copy back.
    const d2 = await applyPush(a.id, [mut('set', setId, set(we, 0, 145, 5), { baseVersion: 1 })]);
    expect(d2[0]).toMatchObject({ status: 'conflict', row: { version: 2, weight: 140, reps: 8 } });

    // Re-applying on top of the current version works.
    const d2b = await applyPush(a.id, [mut('set', setId, set(we, 0, 145, 5), { baseVersion: 2 })]);
    expect(d2b[0]).toMatchObject({ status: 'applied', row: { version: 3, weight: 145 } });
  });

  it('deletes a workout with its contents, and a deletion wins over later edits', async () => {
    const a = await createUser();
    const ids = await logWorkout(a.id);
    const { cursor } = await pullAll(a.id);

    const del = await applyPush(a.id, [mut('workout', ids.workout, undefined, { op: 'delete', baseVersion: 1 })]);
    expect(del[0]).toMatchObject({ status: 'applied', row: null });

    // Tombstones reach other devices.
    const changes = await pullAll(a.id, cursor);
    expect(changes.workouts).toMatchObject([{ id: ids.workout }]);
    expect(changes.workouts[0]!.deletedAt).not.toBeNull();
    expect(changes.workoutExercises[0]!.deletedAt).not.toBeNull();
    expect(changes.sets[0]!.deletedAt).not.toBeNull();

    // A device that was offline still edits a set, and adds one: both come back as conflicts.
    const late = await applyPush(a.id, [
      mut('set', ids.set, set(ids.we, 0, 150, 8), { baseVersion: 1 }),
      mut('set', randomUUID(), set(ids.we, 1, 150, 8)),
    ]);
    expect(late.map((r) => [r.status, r.row])).toEqual([
      ['conflict', null],
      ['conflict', null],
    ]);

    // Deleting again is harmless.
    const again = await applyPush(a.id, [mut('workout', ids.workout, undefined, { op: 'delete' })]);
    expect(again[0]).toMatchObject({ status: 'applied', row: null });
  });

  it('keeps exercise names unique by renaming, and refuses to delete one with history', async () => {
    const a = await createUser();
    const ids = await logWorkout(a.id);

    // Another device created "bench press" offline.
    const dup = await applyPush(a.id, [mut('exercise', randomUUID(), exercise('bench press'))]);
    expect(dup[0]).toMatchObject({ status: 'applied', row: { name: 'bench press (2)' } });

    const del = await applyPush(a.id, [mut('exercise', ids.exercise, undefined, { op: 'delete' })]);
    expect(del[0]).toMatchObject({ status: 'conflict', row: { id: ids.exercise, name: 'Bench Press' } });
    expect(del[0]!.error).toMatch(/history/);

    // Once deleted, the name is free again.
    const unused = randomUUID();
    await applyPush(a.id, [mut('exercise', unused, exercise('Curl'))]);
    await applyPush(a.id, [mut('exercise', unused, undefined, { op: 'delete' })]);
    const curl = await applyPush(a.id, [mut('exercise', randomUUID(), exercise('Curl'))]);
    expect(curl[0]).toMatchObject({ status: 'applied', row: { name: 'Curl' } });
  });

  it('rejects invalid changes without blocking the rest of the batch', async () => {
    const a = await createUser();
    const ids = await logWorkout(a.id);
    const results = await applyPush(a.id, [
      mut('set', randomUUID(), { ...set(ids.we, 1, 135, 8), reps: null }),
      mut('set', randomUUID(), set('missing-parent', 1, 135, 8)),
      mut('set', randomUUID(), { ...set(ids.we, 1, 135, 8), reps: null, durationSec: 60 }),
      mut('settings', 'settings', { defaultUnit: 'kg' }),
    ]);
    expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected', 'applied', 'applied']);
    expect(results[0]!.error).toMatch(/reps or a duration/);
    expect((await pullChanges(a.id, 0n)).user.defaultUnit).toBe('kg');
  });

  it('keeps attendance settings when an older app sends only the unit', async () => {
    const a = await createUser();
    await applyPush(a.id, [
      mut('settings', 'settings', { defaultUnit: 'lb', attendanceRange: '6m', attendanceStart: '2026-09-01' }),
    ]);
    const [result] = await applyPush(a.id, [mut('settings', 'settings', { defaultUnit: 'kg' })]);
    expect(result!.row).toEqual({
      defaultUnit: 'kg',
      attendanceRange: '6m',
      attendanceStart: '2026-09-01',
      weeklyPlan: EMPTY_PLAN,
      planTemplates: [],
    });
    const bad = await applyPush(a.id, [mut('settings', 'settings', { defaultUnit: 'kg', attendanceStart: '2026-02-30' })]);
    expect(bad[0]!.status).toBe('rejected');
    expect((await pullChanges(a.id, 0n)).user).toMatchObject({ attendanceRange: '6m', attendanceStart: '2026-09-01' });
  });

  it('stores the weekly plan with the settings, and keeps it when an older app omits it', async () => {
    const a = await createUser();
    const weeklyPlan = { ...EMPTY_PLAN, mon: { title: 'Upper', items: [{ exerciseId: 'e1', sets: 3, reps: '8–12' }] } };
    const [saved] = await applyPush(a.id, [mut('settings', 'settings', { defaultUnit: 'kg', weeklyPlan })]);
    expect(saved!.status).toBe('applied');
    await applyPush(a.id, [mut('settings', 'settings', { defaultUnit: 'lb' })]);
    expect((await pullChanges(a.id, 0n)).user).toMatchObject({ defaultUnit: 'lb', weeklyPlan });

    const planTemplates = [{ id: 't1', name: 'Travel week', days: weeklyPlan }];
    await applyPush(a.id, [mut('settings', 'settings', { defaultUnit: 'lb', planTemplates })]);
    await applyPush(a.id, [mut('settings', 'settings', { defaultUnit: 'lb', weeklyPlan: EMPTY_PLAN })]);
    expect((await pullChanges(a.id, 0n)).user).toMatchObject({ weeklyPlan: EMPTY_PLAN, planTemplates });
    const [unnamed] = await applyPush(a.id, [
      mut('settings', 'settings', { defaultUnit: 'lb', planTemplates: [{ ...planTemplates[0], name: ' ' }] }),
    ]);
    expect(unnamed!.status).toBe('rejected');

    const tooMany = { ...weeklyPlan, tue: { title: '', items: Array(21).fill(weeklyPlan.mon.items[0]) } };
    const [bad] = await applyPush(a.id, [mut('settings', 'settings', { defaultUnit: 'lb', weeklyPlan: tooMany })]);
    expect(bad!.status).toBe('rejected');
  });

  it("never reads or changes another user's data", async () => {
    const a = await createUser('A');
    const b = await createUser('B');
    const ids = await logWorkout(a.id);

    const results = await applyPush(b.id, [
      // Overwrite A's rows by id.
      mut('set', ids.set, set(ids.we, 0, 999, 1), { baseVersion: 1 }),
      mut('workout', ids.workout, workout(), { baseVersion: 1 }),
      // Attach new rows to A's parents.
      mut('set', randomUUID(), set(ids.we, 1, 999, 1)),
      mut('workoutExercise', randomUUID(), { workoutId: ids.workout, exerciseId: ids.exercise, position: 1, notes: null }),
      // Delete A's rows.
      mut('set', ids.set, undefined, { op: 'delete' }),
      mut('workout', ids.workout, undefined, { op: 'delete' }),
      mut('exercise', ids.exercise, undefined, { op: 'delete' }),
    ]);
    expect(results.slice(0, 4).map((r) => r.status)).toEqual(['rejected', 'rejected', 'rejected', 'rejected']);
    // Same answer as for an id that doesn't exist; nothing about A's row leaks.
    for (const r of results) expect(r.row ?? null).toBeNull();

    const aRows = await pullAll(a.id);
    expect(aRows.sets).toMatchObject([{ id: ids.set, weight: 135, version: 1, deletedAt: null }]);
    expect(aRows.workouts).toMatchObject([{ id: ids.workout, version: 1, deletedAt: null }]);
    expect(aRows.exercises).toMatchObject([{ id: ids.exercise, deletedAt: null }]);

    const bRows = await pullAll(b.id);
    expect([...bRows.exercises, ...bRows.workouts, ...bRows.workoutExercises, ...bRows.sets]).toEqual([]);

    // Mutation ids are per user: B reusing A's mutation id doesn't get A's result.
    const aMutation = mut('settings', 'settings', { defaultUnit: 'kg' });
    await applyPush(a.id, [aMutation]);
    const bSame = await applyPush(b.id, [{ ...aMutation, data: { defaultUnit: 'lb' } }]);
    expect(bSame[0]).toMatchObject({ status: 'applied', row: { defaultUnit: 'lb' } });
  });

  it('pages through changes without skipping or repeating rows', async () => {
    const a = await createUser();
    for (let i = 0; i < 3; i++) await logWorkout(a.id);
    // An update moves a row to the end of the change order.
    const [first] = await prisma.workout.findMany({ where: { userId: a.id }, orderBy: { seq: 'asc' }, take: 1 });
    await applyPush(a.id, [mut('workout', first!.id, { ...workout(), notes: 'edited' }, { baseVersion: 1 })]);

    const all = await pullAll(a.id, 0n, 2);
    const ids = [...all.exercises, ...all.workouts, ...all.workoutExercises, ...all.sets].map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(all.workouts).toHaveLength(3);
    expect(all.sets).toHaveLength(3);
    expect(all.workouts.find((w) => w.id === first!.id)?.notes).toBe('edited');
  });
});
