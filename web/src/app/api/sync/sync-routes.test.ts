import { randomUUID } from 'node:crypto';

import { beforeEach, describe, expect, it } from 'vitest';

import { hasTestDb, resetDb } from '../../../../test/db';
import { SYNC_PROTOCOL } from '@/lib/sync-protocol';
import { auth } from '@/server/auth';

import { GET as pull } from './pull/route';
import { POST as push } from './push/route';

const ORIGIN = 'http://localhost:3000';

/** Signs up through Better Auth and returns the session cookie and user id. */
async function signUp(email: string) {
  const res = await auth.api.signUpEmail({
    body: { email, password: 'correct horse battery', name: 'Test' },
    asResponse: true,
  });
  const cookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const { user } = (await res.json()) as { user: { id: string } };
  return { cookie, userId: user.id };
}

const pushRequest = (body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${ORIGIN}/api/sync/push`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers },
    body: JSON.stringify(body),
  });

const workoutMutation = () => ({
  id: randomUUID(),
  entity: 'workout',
  entityId: randomUUID(),
  op: 'upsert',
  baseVersion: 0,
  data: { startedAt: new Date().toISOString(), endedAt: null, notes: null },
});

describe.skipIf(!hasTestDb)('sync routes', () => {
  beforeEach(resetDb);

  it('requires a valid session', async () => {
    const body = { protocol: SYNC_PROTOCOL, expectedUserId: 'x', mutations: [] };
    expect((await push(pushRequest(body))).status).toBe(401);
    expect((await push(pushRequest(body, { cookie: 'better-auth.session_token=forged.value' }))).status).toBe(401);
    expect((await pull(new Request(`${ORIGIN}/api/sync/pull`))).status).toBe(401);
  });

  it('pushes and pulls for the signed-in user only', async () => {
    const { cookie, userId } = await signUp('a@example.com');
    const m = workoutMutation();

    const res = await push(pushRequest({ protocol: SYNC_PROTOCOL, expectedUserId: userId, mutations: [m] }, { cookie }));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect((await res.json()).results).toMatchObject([{ id: m.id, status: 'applied' }]);

    const pulled = await pull(new Request(`${ORIGIN}/api/sync/pull?cursor=0`, { headers: { cookie } }));
    const body = await pulled.json();
    expect(body.user).toMatchObject({ id: userId, email: 'a@example.com' });
    expect(body.workouts.map((w: { id: string }) => w.id)).toEqual([m.entityId]);
  });

  it("refuses to apply one account's queue to another account", async () => {
    const a = await signUp('a@example.com');
    const b = await signUp('b@example.com');
    const res = await push(
      pushRequest({ protocol: SYNC_PROTOCOL, expectedUserId: a.userId, mutations: [workoutMutation()] }, { cookie: b.cookie }),
    );
    expect(res.status).toBe(409);
  });

  it('refuses cross-site requests and bad input', async () => {
    const { cookie, userId } = await signUp('a@example.com');
    const ok = { protocol: SYNC_PROTOCOL, expectedUserId: userId, mutations: [] };
    expect((await push(pushRequest(ok, { cookie, origin: 'https://evil.example' }))).status).toBe(403);
    expect((await push(pushRequest({ ...ok, mutations: 'nope' }, { cookie }))).status).toBe(400);
    expect((await push(pushRequest({ ...ok, protocol: 99 }, { cookie }))).status).toBe(426);
    expect((await pull(new Request(`${ORIGIN}/api/sync/pull?cursor=-1`, { headers: { cookie } }))).status).toBe(400);
  });
});
