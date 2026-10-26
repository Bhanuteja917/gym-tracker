// Device ↔ server sync, end to end: the real on-device code (Dexie on
// fake-indexeddb) talking to the real push/pull functions on the test database.
import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it } from 'vitest';

import { createUser, hasTestDb, resetDb } from '../../test/db';
import type { PushRequest } from '@/lib/sync-protocol';
import { prisma } from '@/server/db';
import { applyPush, pullChanges } from '@/server/sync';

import { EMPTY_PLAN } from '@/lib/plan';
import { PLAN_TEMPLATES } from '@/lib/plan-templates';

import { applyPullPage } from './apply';
import { getSettings, GymDB } from './db';
import * as local from './mutations';
import { getCurrentExerciseId, getExerciseOrderHistory, getGymDays } from './queries';
import { discardFailed, nextBatch, retryFailed, SyncEngine, type SyncTransport } from './sync-engine';

const set = (weight: number | null, reps: number | null, durationSec: number | null = null) => ({
  weight,
  unit: 'lb' as const,
  reps,
  durationSec,
  rpe: null,
  notes: null,
});

type Server = SyncTransport & {
  offline: boolean;
  /** Apply the push on the server, then lose the response. */
  dropNextResponse: boolean;
  /** Runs on the device while a push is in flight. */
  duringPush?: () => Promise<void>;
  status?: number;
};

/** The server as seen from a device signed in as `userId`. */
function server(userId: string): Server {
  const s: Server = {
    offline: false,
    dropNextResponse: false,
    async push(body: PushRequest) {
      if (s.offline) throw new TypeError('Load failed');
      if (s.status) return new Response(null, { status: s.status });
      if (body.expectedUserId !== userId) return new Response(null, { status: 409 });
      // Through JSON, like the real request.
      const results = await applyPush(userId, JSON.parse(JSON.stringify(body)).mutations);
      await s.duringPush?.();
      s.duringPush = undefined;
      if (s.dropNextResponse) {
        s.dropNextResponse = false;
        throw new TypeError('Load failed');
      }
      return Response.json({ results });
    },
    async pull(cursor: string) {
      if (s.offline) throw new TypeError('Load failed');
      if (s.status) return new Response(null, { status: s.status });
      return Response.json(JSON.parse(JSON.stringify(await pullChanges(userId, BigInt(cursor)))));
    },
  };
  return s;
}

function device(userId: string) {
  const db = new GymDB(`test-${crypto.randomUUID()}`);
  const net = server(userId);
  const engine = new SyncEngine(db, userId, net);
  return { db, net, engine };
}

const serverSets = (userId: string) =>
  prisma.exerciseSet.findMany({ where: { userId, deletedAt: null }, orderBy: { position: 'asc' } });

describe.skipIf(!hasTestDb)('offline logging and sync', () => {
  beforeEach(resetDb);

  it('logs a whole workout offline and syncs it when the connection returns', async () => {
    const user = await createUser();
    const { db, net, engine } = device(user.id);
    net.offline = true;

    const workoutId = await local.startWorkout(db);
    await local.createExercise(db, { name: 'Bench Press', muscleGroup: 'Chest', videoUrl: null }, workoutId);
    const [we] = await db.workoutExercises.toArray();
    const s1 = await local.addSet(db, we!.id, set(135, 8));
    const s2 = await local.addSet(db, we!.id, set(135, 7));
    await local.addSet(db, we!.id, set(null, null, 60));
    await local.updateSet(db, s1, set(140, 8));
    await local.deleteSet(db, s2);
    await local.updateWorkoutNotes(db, workoutId, 'Felt strong');
    await local.finishWorkout(db, workoutId);

    // Edits to unsent records were folded in; the deleted set never queued anything.
    const queued = await db.outbox.toArray();
    expect(queued.map((e) => `${e.entity}:${e.op}`).sort()).toEqual(
      ['exercise:upsert', 'set:upsert', 'set:upsert', 'workout:upsert', 'workoutExercise:upsert'].sort(),
    );

    await engine.sync();
    expect(engine.getState().problem).toBe('offline');
    expect(await db.outbox.count()).toBe(5);

    net.offline = false;
    await engine.sync();
    expect(engine.getState()).toMatchObject({ problem: null, syncing: false });
    expect(await db.outbox.count()).toBe(0);

    const workout = await prisma.workout.findUniqueOrThrow({ where: { id: workoutId } });
    expect(workout.notes).toBe('Felt strong');
    expect(workout.endedAt).not.toBeNull();
    expect((await serverSets(user.id)).map((s) => [s.weight, s.reps, s.durationSec])).toEqual([
      [140, 8, null],
      [null, null, 60],
    ]);
    // The device now knows the server versions.
    expect((await db.workouts.get(workoutId))!.version).toBe(1);
  });

  it('does not duplicate anything when a response is lost', async () => {
    const user = await createUser();
    const { db, net, engine } = device(user.id);
    const workoutId = await local.startWorkout(db);
    await local.createExercise(db, { name: 'Squat', muscleGroup: null, videoUrl: null }, workoutId);
    const [we] = await db.workoutExercises.toArray();
    await local.addSet(db, we!.id, set(225, 5));

    net.dropNextResponse = true;
    await engine.sync();
    expect(engine.getState().problem).toBe('offline');
    expect(await db.outbox.count()).toBe(4); // the device can't know it arrived

    await engine.sync();
    expect(await db.outbox.count()).toBe(0);
    expect(await prisma.workout.count({ where: { userId: user.id } })).toBe(1);
    expect(await serverSets(user.id)).toHaveLength(1);
  });

  it('keeps an edit made while its record is being sent', async () => {
    const user = await createUser();
    const { db, net, engine } = device(user.id);
    const workoutId = await local.startWorkout(db);
    net.duringPush = () => local.updateWorkoutNotes(db, workoutId, 'typed during sync');

    await engine.sync();
    expect(await db.outbox.count()).toBe(0);
    expect(await db.conflicts.count()).toBe(0);
    const row = await prisma.workout.findUniqueOrThrow({ where: { id: workoutId } });
    expect(row.notes).toBe('typed during sync');
    expect(row.version).toBe(2);
  });

  it('drops queued changes for something deleted before it was ever sent', async () => {
    const user = await createUser();
    const { db, engine } = device(user.id);
    const ex = await local.createExercise(db, { name: 'Row', muscleGroup: null, videoUrl: null });
    const workoutId = await local.startWorkout(db);
    const we = await local.addExerciseToWorkout(db, workoutId, ex);
    await local.addSet(db, we, set(100, 10));
    await local.deleteWorkout(db, workoutId);

    expect((await db.outbox.toArray()).map((e) => e.entity)).toEqual(['exercise']);
    await engine.sync();
    expect(await prisma.workout.count()).toBe(0);
    expect(await prisma.exercise.count({ where: { userId: user.id } })).toBe(1);
  });

  it('discards an empty workout on finish, offline too', async () => {
    const user = await createUser();
    const { db } = device(user.id);
    const workoutId = await local.startWorkout(db);
    expect(await local.startWorkout(db)).toBe(workoutId); // one at a time
    expect(await local.finishWorkout(db, workoutId)).toEqual({ discarded: true });
    expect(await db.workouts.count()).toBe(0);
    expect(await db.outbox.count()).toBe(0);
  });

  describe('two devices', () => {
    async function twoSyncedDevices() {
      const user = await createUser();
      const phone = device(user.id);
      const workoutId = await local.startWorkout(phone.db);
      await local.createExercise(phone.db, { name: 'Bench', muscleGroup: null, videoUrl: null }, workoutId);
      const [we] = await phone.db.workoutExercises.toArray();
      const setId = await local.addSet(phone.db, we!.id, set(135, 8));
      await phone.engine.sync();
      const ipad = device(user.id);
      await ipad.engine.sync();
      return { user, phone, ipad, workoutId, weId: we!.id, setId };
    }

    it('downloads everything to a new device', async () => {
      const { ipad, setId } = await twoSyncedDevices();
      expect(await ipad.db.sets.get(setId)).toMatchObject({ weight: 135, reps: 8, version: 1 });
      expect(await ipad.db.exercises.count()).toBe(1);
    });

    it('keeps the server copy on conflicting edits and saves the losing edit for review', async () => {
      const { phone, ipad, setId } = await twoSyncedDevices();
      await local.updateSet(phone.db, setId, set(140, 8));
      await local.updateSet(ipad.db, setId, set(145, 6));

      await phone.engine.sync();
      await ipad.engine.sync();

      expect(await ipad.db.sets.get(setId)).toMatchObject({ weight: 140, reps: 8, version: 2 });
      const [conflict] = await ipad.db.conflicts.toArray();
      expect(conflict).toMatchObject({ entity: 'set', entityId: setId, local: { weight: 145, reps: 6 } });
      expect(await ipad.db.outbox.count()).toBe(0);
    });

    it('lets a deletion win and removes what was added to the deleted workout', async () => {
      const { phone, ipad, workoutId, weId } = await twoSyncedDevices();
      await local.deleteWorkout(phone.db, workoutId);
      const added = await local.addSet(ipad.db, weId, set(150, 3));

      await phone.engine.sync();
      await ipad.engine.sync();

      expect(await ipad.db.sets.get(added)).toBeUndefined();
      expect(await ipad.db.workouts.get(workoutId)).toBeUndefined();
      expect(await ipad.db.conflicts.count()).toBe(1);
      expect(await ipad.db.outbox.count()).toBe(0);
    });

    it("doesn't let a pull overwrite a change that is still queued", async () => {
      const { user, phone, ipad, workoutId } = await twoSyncedDevices();
      await local.updateWorkoutNotes(phone.db, workoutId, 'from phone');
      await phone.engine.sync();
      await local.updateWorkoutNotes(ipad.db, workoutId, 'from ipad');

      // A pull lands before the iPad's change is sent.
      await applyPullPage(ipad.db, JSON.parse(JSON.stringify(await pullChanges(user.id, 0n))));
      expect((await ipad.db.workouts.get(workoutId))!.notes).toBe('from ipad');

      // Sending it then conflicts; the iPad shows the server copy and keeps its own for review.
      await ipad.engine.sync();
      expect((await ipad.db.workouts.get(workoutId))!.notes).toBe('from phone');
      expect((await ipad.db.conflicts.toArray())[0]).toMatchObject({ local: { notes: 'from ipad' } });
    });
  });

  it('pauses with a reason when signed out or another account is signed in, keeping the queue', async () => {
    const user = await createUser();
    const { db, net, engine } = device(user.id);
    await local.startWorkout(db);

    net.status = 401;
    await engine.sync();
    expect(engine.getState().problem).toBe('auth');
    expect(await db.outbox.count()).toBe(1);

    net.status = 409;
    await engine.sync();
    expect(engine.getState().problem).toBe('account');
    expect(await db.outbox.count()).toBe(1);

    // The other account's server never receives this device's queue.
    const other = await createUser();
    const wrong = new SyncEngine(db, user.id, server(other.id));
    await wrong.sync();
    expect(wrong.getState().problem).toBe('account');
    expect(await prisma.workout.count()).toBe(0);
  });

  it('marks a change the server rejects as failed, and lets the user retry or discard it', async () => {
    const user = await createUser();
    const { db, engine } = device(user.id);
    const workoutId = await local.startWorkout(db);
    await engine.sync();
    // A change the server won't accept (bypassing the app's own validation).
    await db.outbox.add({
      mutationId: crypto.randomUUID(),
      entity: 'workout',
      entityId: workoutId,
      op: 'upsert',
      baseVersion: 1,
      data: { startedAt: 'not a date', endedAt: null, notes: null },
      status: 'pending',
      attempts: 0,
      createdAt: new Date(),
    });
    await engine.sync();
    const [failed] = await db.outbox.toArray();
    expect(failed).toMatchObject({ status: 'failed' });
    expect(await nextBatch(db)).toEqual([]);

    await retryFailed(db, failed!.seq);
    expect(await nextBatch(db)).toHaveLength(1);
    await engine.sync();
    await discardFailed(db, (await db.outbox.toArray())[0]!.seq!);
    await engine.sync();
    expect(await db.outbox.count()).toBe(0);
    expect(await db.workouts.get(workoutId)).toMatchObject({ version: 1 });
  });

  it('syncs settings, last write wins', async () => {
    const user = await createUser();
    const a = device(user.id);
    const b = device(user.id);
    await local.updateSettings(a.db, { defaultUnit: 'kg' });
    await local.updateSettings(a.db, { attendanceRange: '6m', attendanceStart: '2026-09-01' });
    await a.engine.sync();
    await b.engine.sync();
    expect(await getSettings(b.db)).toEqual({
      defaultUnit: 'kg',
      attendanceRange: '6m',
      attendanceStart: '2026-09-01',
      weeklyPlan: EMPTY_PLAN,
      planTemplates: [],
    });

    await local.updateSettings(b.db, { attendanceStart: null });
    await b.engine.sync();
    await a.engine.sync();
    expect(await getSettings(a.db)).toMatchObject({ defaultUnit: 'kg', attendanceStart: null });
  });

  it('counts days with a finished workout for the attendance grid', async () => {
    const user = await createUser();
    const { db } = device(user.id);
    const day = (d: number, h: number) => new Date(2026, 9, d, h);
    const exerciseId = await local.createExercise(db, { name: 'Squat', muscleGroup: null, videoUrl: null });
    for (const [start, finish] of [
      [day(1, 7), true],
      [day(1, 18), true],
      [day(3, 23), true],
      [day(5, 9), false], // still in progress
    ] as const) {
      const id = await local.startWorkout(db, start);
      if (finish) {
        const we = await local.addExerciseToWorkout(db, id, exerciseId);
        await local.addSet(db, we, set(100, 5), start);
        await local.finishWorkout(db, id, start);
      }
    }
    const days = await getGymDays(db, day(1, 0), day(5, 0));
    expect([...days.keys()].sort()).toEqual(['2026-10-01', '2026-10-03']);
    expect(days.get('2026-10-01')).toMatchObject({ logged: true });
  });

  it('marks a day as attended without logging, and syncs it', async () => {
    const user = await createUser();
    const a = device(user.id);
    const b = device(user.id);
    const now = new Date(2026, 9, 15, 18);
    await local.markGymDay(a.db, '2026-10-13', now);
    await local.markGymDay(a.db, '2026-10-13', now); // already marked: no second record
    await local.markGymDay(a.db, '2026-10-15', now);
    await expect(local.markGymDay(a.db, '2026-10-16', now)).rejects.toThrow(/hasn’t happened/);
    await a.engine.sync();
    await b.engine.sync();
    const range = [new Date(2026, 9, 1), new Date(2026, 9, 20)] as const;
    const days = await getGymDays(b.db, ...range);
    expect([...days.keys()].sort()).toEqual(['2026-10-13', '2026-10-15']);
    expect(days.get('2026-10-13')).toMatchObject({ logged: false });

    // Logging a real workout that day replaces the mark.
    const id = await local.startWorkout(b.db, new Date(2026, 9, 15, 19));
    const ex = await local.createExercise(b.db, { name: 'Row', muscleGroup: null, videoUrl: null });
    const we = await local.addExerciseToWorkout(b.db, id, ex);
    await local.addSet(b.db, we, set(100, 5));
    await local.finishWorkout(b.db, id, new Date(2026, 9, 15, 20));
    expect((await getGymDays(b.db, ...range)).get('2026-10-15')).toEqual({ workoutIds: [id], logged: true });

    await local.unmarkGymDay(b.db, '2026-10-13');
    await expect(local.unmarkGymDay(b.db, '2026-10-15')).rejects.toThrow(/logged workout/);
    await b.engine.sync();
    await a.engine.sync();
    expect([...(await getGymDays(a.db, ...range)).keys()]).toEqual(['2026-10-15']);
    expect(await prisma.workout.count({ where: { userId: user.id, deletedAt: null } })).toBe(1);
  });

  describe('weekly plan', () => {
    it('applies a template, reusing exercises already logged under another name, and syncs it', async () => {
      const user = await createUser();
      const a = device(user.id);
      const b = device(user.id);
      // A logged "Lat Pulldown" wins over the library's unused "Wide-Grip Lat Pulldown".
      const mine = await local.createExercise(a.db, { name: 'Lat Pulldown', muscleGroup: 'Back', videoUrl: null });
      const library = await local.createExercise(a.db, {
        name: 'Wide-Grip Lat Pulldown',
        muscleGroup: null,
        videoUrl: null,
      });
      const old = await local.startWorkout(a.db);
      await local.addSet(a.db, await local.addExerciseToWorkout(a.db, old, mine), set(50, 10));
      await local.finishWorkout(a.db, old);
      const archived = await local.createExercise(a.db, { name: 'Face Pull', muscleGroup: null, videoUrl: null });
      await local.setExerciseArchived(a.db, archived, true);

      const gym = PLAN_TEMPLATES.find((t) => t.id === 'gym-5')!;
      await local.applyPlanTemplate(a.db, gym.days);
      const { weeklyPlan } = await getSettings(a.db);
      expect(weeklyPlan.mon.title).toBe('Upper');
      expect(weeklyPlan.mon.items.map((i) => i.exerciseId)).toContain(mine);
      expect(weeklyPlan.mon.items.map((i) => i.exerciseId)).not.toContain(library);
      expect(weeklyPlan.fri.items.map((i) => i.exerciseId)).toContain(archived);
      expect(await a.db.exercises.get(archived)).toMatchObject({ archived: false });
      expect(weeklyPlan.wed.items).toEqual([]);
      // Applying it again adds no exercises.
      const count = await a.db.exercises.count();
      await local.applyPlanTemplate(a.db, gym.days);
      expect(await a.db.exercises.count()).toBe(count);

      await a.engine.sync();
      await b.engine.sync();
      expect((await getSettings(b.db)).weeklyPlan).toEqual(weeklyPlan);
      for (const item of weeklyPlan.tue.items) expect(await b.db.exercises.get(item.exerciseId)).toBeDefined();
    });

    it("starts a workout with a day's exercises in order, skipping deleted ones", async () => {
      const user = await createUser();
      const { db } = device(user.id);
      const squat = await local.createExercise(db, { name: 'Squat', muscleGroup: null, videoUrl: null });
      const curl = await local.createExercise(db, { name: 'Leg Curl', muscleGroup: null, videoUrl: null });
      const gone = await local.createExercise(db, { name: 'Gone', muscleGroup: null, videoUrl: null });
      await local.updatePlanDay(db, 'tue', {
        title: 'Legs',
        items: [curl, gone, squat].map((exerciseId) => ({ exerciseId, sets: 3, reps: '8–12' })),
      });
      await local.deleteExercise(db, gone);
      const ids = (await getSettings(db)).weeklyPlan.tue.items.map((i) => i.exerciseId);
      const workoutId = await local.startWorkout(db, new Date(2026, 9, 13), ids);
      const rows = await db.workoutExercises.where('workoutId').equals(workoutId).sortBy('position');
      expect(rows.map((r) => r.exerciseId)).toEqual([curl, squat]);
      // With a workout already in progress, that one is returned unchanged.
      expect(await local.startWorkout(db, new Date(), [gone])).toBe(workoutId);
      await expect(
        local.updatePlanDay(db, 'mon', {
          title: '',
          items: Array.from({ length: 21 }, () => ({ exerciseId: squat, sets: 1, reps: '' })),
        }),
      ).rejects.toThrow(/up to 20/);
    });

    it('saves, edits, uses and deletes your own templates, and syncs them', async () => {
      const user = await createUser();
      const a = device(user.id);
      const b = device(user.id);
      const squat = await local.createExercise(a.db, { name: 'Squat', muscleGroup: null, videoUrl: null });
      const row = await local.createExercise(a.db, { name: 'Row', muscleGroup: null, videoUrl: null });
      await local.updatePlanDay(a.db, 'mon', { title: 'Legs', items: [{ exerciseId: squat, sets: 3, reps: '5' }] });

      // From the current week: a copy, so changing the week doesn't change it.
      const fromWeek = await local.createTemplate(a.db, '  Strength  ', 'week');
      await local.updatePlanDay(a.db, 'mon', { title: '', items: [] });
      let { planTemplates } = await getSettings(a.db);
      expect(planTemplates).toHaveLength(1);
      expect(planTemplates[0]).toMatchObject({ id: fromWeek, name: 'Strength' });
      expect(planTemplates[0]!.days.mon.items.map((i) => i.exerciseId)).toEqual([squat]);

      // Edit a day of the template, and rename it.
      const pull = { title: 'Pull', items: [{ exerciseId: row, sets: 4, reps: '8–12' }] };
      await local.updatePlanDay(a.db, 'thu', pull, fromWeek);
      await local.renameTemplate(a.db, fromWeek, 'Strength 2');
      expect((await getSettings(a.db)).weeklyPlan.thu.items).toEqual([]);
      await expect(local.renameTemplate(a.db, fromWeek, '   ')).rejects.toThrow(/name/);
      await expect(local.updatePlanDay(a.db, 'thu', { title: '', items: [] }, 'nope')).rejects.toThrow(/not found/);

      // From a built-in template, and an empty one.
      const gym = await local.createTemplate(a.db, 'My gym', PLAN_TEMPLATES[0]!.days);
      const empty = await local.createTemplate(a.db, 'Blank', 'empty');
      ({ planTemplates } = await getSettings(a.db));
      expect(planTemplates.map((t) => t.name)).toEqual(['Strength 2', 'My gym', 'Blank']);
      expect(planTemplates[1]!.days.mon.items.length).toBeGreaterThan(0);
      expect(planTemplates[2]!.days).toEqual(EMPTY_PLAN);

      // Use it for the week; an exercise deleted since is left out.
      await local.deleteExercise(a.db, row);
      await local.applyUserTemplate(a.db, fromWeek);
      let { weeklyPlan } = await getSettings(a.db);
      expect(weeklyPlan.mon).toMatchObject({ title: 'Legs' });
      expect(weeklyPlan.thu).toEqual({ title: 'Pull', items: [] });
      // Copy one template day into the plan.
      await local.copyPlanDay(a.db, 'sat', planTemplates[0]!.days.mon);
      ({ weeklyPlan } = await getSettings(a.db));
      expect(weeklyPlan.sat.items.map((i) => i.exerciseId)).toEqual([squat]);

      await local.deleteTemplate(a.db, empty);
      await a.engine.sync();
      await b.engine.sync();
      const synced = await getSettings(b.db);
      expect(synced.planTemplates.map((t) => t.id)).toEqual([fromWeek, gym]);
      expect(synced.weeklyPlan).toEqual(weeklyPlan);
    });
  });
  it('keeps exercises in the order they were done, and syncs it', async () => {
    const user = await createUser();
    const { db, engine } = device(user.id);
    const ex = async (name: string) => local.createExercise(db, { name, muscleGroup: null, videoUrl: null });
    const [bench, row, press] = [await ex('Bench'), await ex('Row'), await ex('Press')];
    const workoutId = await local.startWorkout(db, new Date(2026, 9, 26, 18), [bench, row, press]);
    const rows = await db.workoutExercises.where('workoutId').equals(workoutId).sortBy('position');
    const idOf = Object.fromEntries(rows.map((r) => [r.exerciseId, r.id]));
    const order = async () =>
      (await db.workoutExercises.where('workoutId').equals(workoutId).sortBy('position')).map((r) => r.exerciseId);

    // Start with the last planned exercise: it moves to the top.
    await local.setCurrentExercise(db, workoutId, idOf[press]!);
    expect(await getCurrentExerciseId(db, workoutId)).toBe(idOf[press]);
    expect(await getCurrentExerciseId(db, 'another-workout')).toBeNull();
    await local.addSet(db, idOf[press]!, set(50, 10), new Date(2026, 9, 26, 18, 5));
    expect(await order()).toEqual([press, bench, row]);
    await local.addSet(db, idOf[row]!, set(80, 10), new Date(2026, 9, 26, 18, 20));
    expect(await order()).toEqual([press, row, bench]);
    // More sets don't move anything; an exercise whose sets are all deleted goes back to "not done".
    const extra = await local.addSet(db, idOf[press]!, set(50, 8), new Date(2026, 9, 26, 18, 30));
    expect(await order()).toEqual([press, row, bench]);
    await local.addSet(db, idOf[bench]!, set(100, 5), new Date(2026, 9, 26, 18, 40));
    const rowSet = (await db.sets.where('workoutExerciseId').equals(idOf[row]!).first())!;
    await local.deleteSet(db, rowSet.id);
    expect(await order()).toEqual([press, bench, row]);
    await local.deleteSet(db, extra);
    expect(await order()).toEqual([press, bench, row]);

    await engine.sync();
    const onServer = await prisma.workoutExercise.findMany({ where: { workoutId }, orderBy: { position: 'asc' } });
    expect(onServer.map((r) => r.exerciseId)).toEqual([press, bench, row]);

    expect(await getExerciseOrderHistory(db, bench)).toMatchObject([{ workoutId, order: 2, after: 'Press' }]);
    expect(await getExerciseOrderHistory(db, row)).toEqual([]);

    // Dragging sets the order; a later first set goes after it without undoing it.
    await local.reorderDone(db, workoutId, [idOf[bench]!, idOf[press]!]);
    expect(await order()).toEqual([bench, press, row]);
    await local.addSet(db, idOf[row]!, set(80, 10), new Date(2026, 9, 26, 18, 50));
    expect(await order()).toEqual([bench, press, row]);
    await expect(local.reorderDone(db, workoutId, [idOf[press]!, idOf[bench]!])).rejects.toThrow(/changed/);
    expect(await getExerciseOrderHistory(db, bench)).toMatchObject([{ order: 1, after: null }]);
    expect(await getExerciseOrderHistory(db, row)).toMatchObject([{ order: 3, after: 'Press' }]);

    await engine.sync();
    const reordered = await prisma.workoutExercise.findMany({ where: { workoutId }, orderBy: { position: 'asc' } });
    expect(reordered.map((r) => r.exerciseId)).toEqual([bench, press, row]);
  });
});
