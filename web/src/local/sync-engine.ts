/**
 * Moves changes between the on-device database and the server: push the
 * outbox (oldest first), then pull everything changed since the last cursor.
 *
 * Reachability comes from these requests themselves, never from
 * navigator.onLine (gym Wi-Fi behind a login page reports "online").
 * Failures back off 2 s → 5 s → 15 s → 1 min → 5 min; a local change, the app
 * coming to the foreground or "Sync now" retries at once.
 */
import {
  PUSH_BATCH_SIZE,
  SYNC_PROTOCOL,
  type MutationResult,
  type PullResponse,
  type PushRequest,
  type SyncUser,
} from '@/lib/sync-protocol';

import { applyPullPage, applyPushResults } from './apply';
import { type GymDB, getMeta, type OutboxEntry, setMeta } from './db';

/** Why the last sync didn't complete. */
export type SyncProblem =
  | 'offline' // no answer (no signal, timeout, captive Wi-Fi)
  | 'auth' // the session expired or was signed out: sign in to sync
  | 'account' // a different account is signed in
  | 'update' // the server needs a newer app version
  | 'server'; // the server failed

export type SyncState = {
  syncing: boolean;
  problem: SyncProblem | null;
  lastSyncAt: Date | null;
  /** Set when the server reports a different signed-in account. */
  sessionUserId?: string;
  /** The account as the server last described it (name, email, unit). */
  account?: SyncUser;
};

/** The transport, injectable for tests. */
export type SyncTransport = {
  push(body: PushRequest): Promise<Response>;
  pull(cursor: string): Promise<Response>;
};

const TIMEOUT_MS = 15_000;

export const httpTransport: SyncTransport = {
  push: (body) =>
    fetch('/api/sync/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'same-origin',
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }),
  pull: (cursor) =>
    fetch(`/api/sync/pull?cursor=${encodeURIComponent(cursor)}`, {
      credentials: 'same-origin',
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }),
};

const BACKOFF_MS = [2_000, 5_000, 15_000, 60_000, 300_000];

class SyncError extends Error {
  constructor(
    readonly problem: SyncProblem,
    readonly sessionUserId?: string,
  ) {
    super(problem);
  }
}

function problemFor(status: number): SyncProblem {
  if (status === 401) return 'auth';
  if (status === 409) return 'account';
  if (status === 426) return 'update';
  return 'server';
}

async function request(send: () => Promise<Response>): Promise<Response> {
  let response: Response;
  try {
    response = await send();
  } catch {
    throw new SyncError('offline');
  }
  // A redirect means something in between (a captive portal, the sign-in page) answered.
  if (response.redirected) throw new SyncError('offline');
  if (!response.ok) throw new SyncError(problemFor(response.status));
  return response;
}

/**
 * The next entries to send: oldest first, at most one per record, so each
 * entry's baseVersion can be updated from the previous one's result.
 */
export async function nextBatch(db: GymDB, limit = PUSH_BATCH_SIZE): Promise<OutboxEntry[]> {
  const seen = new Set<string>();
  const batch: OutboxEntry[] = [];
  await db.outbox.orderBy('seq').until(() => batch.length >= limit).each((entry) => {
    const key = `${entry.entity}:${entry.entityId}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (entry.status === 'pending') batch.push(entry);
  });
  return batch;
}

export class SyncEngine {
  private state: SyncState = { syncing: false, problem: null, lastSyncAt: null };
  private listeners = new Set<() => void>();
  private running: Promise<void> | null = null;
  private again = false;
  private failures = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(
    readonly db: GymDB,
    readonly userId: string,
    private readonly transport: SyncTransport = httpTransport,
    /** Called with the account the server says is signed in, when it isn't `userId`. */
    private readonly onUser?: (user: SyncUser) => void,
  ) {
    void getMeta(db, 'lastSyncAt').then((lastSyncAt) => {
      if (lastSyncAt && !this.state.lastSyncAt) this.update({ lastSyncAt });
    });
  }

  getState = (): SyncState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private update(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  /** Sync soon (after a local change): batches quick successive edits. */
  schedule(delayMs = 800): void {
    if (this.stopped) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.sync(), delayMs);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  /**
   * Runs one sync now; a call during a sync runs another one right after.
   * Resolves when done, never rejects (the outcome is in the state).
   */
  sync(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = this.withLock(async () => {
      do {
        this.again = false;
        await this.syncOnce();
      } while (this.again && !this.stopped);
    }).finally(() => {
      this.running = null;
    });
    return this.running;
  }

  /** One device-wide sync at a time, across tabs (Web Locks, Safari 15.4+). */
  private async withLock(fn: () => Promise<void>): Promise<void> {
    if (typeof navigator !== 'undefined' && navigator.locks) {
      await navigator.locks.request(`gym-sync-${this.userId}`, fn);
    } else {
      await fn();
    }
  }

  private async syncOnce(): Promise<void> {
    this.update({ syncing: true });
    try {
      try {
        await this.pushAll();
      } catch (error) {
        // The push was refused for another account: a pull says which one is signed in.
        if (error instanceof SyncError && error.problem === 'account') await this.pullAll();
        throw error;
      }
      await this.pullAll();
      const lastSyncAt = new Date();
      await setMeta(this.db, 'lastSyncAt', lastSyncAt);
      this.failures = 0;
      this.update({ syncing: false, problem: null, lastSyncAt, sessionUserId: undefined });
    } catch (error) {
      if (!(error instanceof SyncError)) {
        console.error('sync failed', error);
      }
      const problem = error instanceof SyncError ? error.problem : 'server';
      const sessionUserId = error instanceof SyncError ? error.sessionUserId : undefined;
      this.update({ syncing: false, problem, sessionUserId });
      if (problem === 'offline' || problem === 'server') {
        const delay = BACKOFF_MS[Math.min(this.failures, BACKOFF_MS.length - 1)]!;
        this.failures += 1;
        this.schedule(delay * (0.8 + Math.random() * 0.4));
      }
    }
  }

  private async pushAll(): Promise<void> {
    for (;;) {
      const batch = await nextBatch(this.db);
      if (batch.length === 0) return;
      // Counted before sending: an entry that may have reached the server is
      // never edited in place again (a retry with the same id must mean the same change).
      await this.db.outbox.bulkUpdate(batch.map((e) => ({ key: e.seq!, changes: { attempts: e.attempts + 1 } })));
      const response = await request(() =>
        this.transport.push({
          protocol: SYNC_PROTOCOL,
          expectedUserId: this.userId,
          mutations: batch.map((e) => ({
            id: e.mutationId,
            entity: e.entity,
            entityId: e.entityId,
            op: e.op,
            baseVersion: e.baseVersion,
            ...(e.op === 'upsert' ? { data: e.data } : {}),
          })),
        }),
      );
      const { results } = (await response.json()) as { results: MutationResult[] };
      await applyPushResults(this.db, batch, results);
    }
  }

  private async pullAll(): Promise<void> {
    for (;;) {
      const cursor = (await getMeta(this.db, 'pullCursor')) ?? '0';
      const response = await request(() => this.transport.pull(cursor));
      const page = (await response.json()) as PullResponse;
      if (page.user.id !== this.userId) {
        this.onUser?.(page.user);
        throw new SyncError('account', page.user.id);
      }
      await applyPullPage(this.db, page);
      this.update({ account: page.user });
      if (!page.hasMore) return;
    }
  }

  /**
   * Best effort when the app goes to the background: sends what fits in a
   * keepalive request without waiting for the answer. Anything sent is
   * resent with the same ids on the next sync, which the server answers
   * from its log.
   */
  async flushInBackground(): Promise<void> {
    if (this.running || typeof fetch === 'undefined') return;
    const batch = await nextBatch(this.db, 50);
    if (batch.length === 0) return;
    const body = JSON.stringify({
      protocol: SYNC_PROTOCOL,
      expectedUserId: this.userId,
      mutations: batch.map((e) => ({
        id: e.mutationId,
        entity: e.entity,
        entityId: e.entityId,
        op: e.op,
        baseVersion: e.baseVersion,
        ...(e.op === 'upsert' ? { data: e.data } : {}),
      })),
    } satisfies PushRequest);
    if (body.length > 60_000) return; // keepalive bodies are capped at 64 KB
    await this.db.outbox.bulkUpdate(batch.map((e) => ({ key: e.seq!, changes: { attempts: e.attempts + 1 } })));
    fetch('/api/sync/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      credentials: 'same-origin',
    }).catch(() => {});
  }
}

/** Sends a failed change again (after the user taps Retry). */
export async function retryFailed(db: GymDB, seq?: number): Promise<void> {
  const failed = seq === undefined ? db.outbox.where('status').equals('failed') : db.outbox.where('seq').equals(seq);
  await failed.modify({ status: 'pending', error: undefined, mutationId: crypto.randomUUID() });
}

/** Drops a change the server rejected, and restores the server's copy on the next pull. */
export async function discardFailed(db: GymDB, seq: number): Promise<void> {
  await db.transaction('rw', db.outbox, db.meta, async () => {
    await db.outbox.delete(seq);
    // Re-pull everything so the record returns to the server's version.
    await setMeta(db, 'pullCursor', '0');
  });
}
