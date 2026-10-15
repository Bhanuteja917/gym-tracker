'use client';

/**
 * Opens the signed-in account's on-device database, runs the sync engine, and
 * gives screens access to both. Sync runs on launch, after every local change,
 * when the app returns to the foreground or the network comes back, and every
 * minute while open. iOS gives web apps no background sync, so this is it.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, type ReactNode, use, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import type { PullResponse, SyncUser } from '@/lib/sync-protocol';

import { getStoredAccount, getUnsyncedAccount, setStoredAccount, setUnsyncedAccount, type StoredAccount } from './account';
import { applyPullPage } from './apply';
import { type GymDB, openUserDb } from './db';
import { LocalError } from './mutations';
import { httpTransport, SyncEngine, type SyncState } from './sync-engine';

export type BootState =
  | { status: 'loading' }
  /** No account on this device yet and no connection to ask the server. */
  | { status: 'offline' }
  | { status: 'error' }
  | { status: 'ready'; db: GymDB; engine: SyncEngine; account: StoredAccount };

type Ready = Extract<BootState, { status: 'ready' }>;

export type MutationResult<T> = { ok: true; data: T } | { ok: false; error: string };

type LocalContextValue = Ready & {
  /** Runs a local change, then schedules a sync. Turns LocalError into a message. */
  mutate<T>(fn: (db: GymDB) => Promise<T>): Promise<MutationResult<T>>;
};

const BootContext = createContext<{ state: BootState; retry: () => void }>({ state: { status: 'loading' }, retry: () => {} });
const LocalContext = createContext<LocalContextValue | null>(null);

const toAccount = (u: SyncUser): StoredAccount => ({ id: u.id, email: u.email, name: u.name });

/** Another account signed in on this device: remember any unsynced work, then reopen as them. */
async function switchAccount(previous: StoredAccount, db: GymDB, next: SyncUser) {
  const count = await db.outbox.count();
  if (count > 0) setUnsyncedAccount({ email: previous.email, count });
  setStoredAccount(toAccount(next));
  window.location.reload();
}

export function LocalDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BootState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let engine: SyncEngine | null = null;
    let cancelled = false;

    function start(account: StoredAccount, db = openUserDb(account.id)) {
      if (cancelled) return;
      engine = new SyncEngine(db, account.id, httpTransport, (user) => void switchAccount(account, db, user));
      setState({ status: 'ready', db, engine, account });
      void engine.sync();
    }

    async function boot() {
      const stored = getStoredAccount();
      if (stored) return start(stored);
      // First launch on this device, or after signing out: ask who is signed in
      // (this validates the session) and download everything.
      let response: Response;
      try {
        response = await fetch('/api/sync/pull?cursor=0', { cache: 'no-store', credentials: 'same-origin' });
      } catch {
        return setState({ status: 'offline' });
      }
      if (response.status === 401) return window.location.replace('/sign-in');
      if (!response.ok || response.redirected) return setState({ status: 'error' });
      const page = (await response.json()) as PullResponse;
      const account = toAccount(page.user);
      const db = openUserDb(account.id);
      await applyPullPage(db, page);
      setStoredAccount(account);
      // This account's unsynced changes (if it signed out with some) are about to sync.
      if (getUnsyncedAccount()?.email === account.email) setUnsyncedAccount(null);
      start(account, db);
    }

    void boot().catch((error) => {
      console.error('Opening local data failed', error);
      if (!cancelled) setState({ status: 'error' });
    });
    return () => {
      cancelled = true;
      engine?.stop();
    };
  }, [attempt]);

  // Sync triggers while the app is open.
  const engine = state.status === 'ready' ? state.engine : null;
  useEffect(() => {
    if (!engine) return;
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void engine.sync();
      else void engine.flushInBackground();
    };
    const onOnline = () => void engine.sync();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void engine.sync();
    }, 60_000);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    // Ask Safari to keep this site's storage (iOS 17+; granted at its discretion).
    void navigator.storage?.persist?.().catch(() => {});
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
    };
  }, [engine]);

  // Keep the remembered name and email current.
  const account = useSyncExternalStore(
    engine?.subscribe ?? noopSubscribe,
    () => engine?.getState().account,
    () => undefined,
  );
  useEffect(() => {
    if (state.status !== 'ready' || !account || account.id !== state.account.id) return;
    if (account.email !== state.account.email || account.name !== state.account.name) {
      setStoredAccount(toAccount(account));
    }
  }, [account, state]);

  const mutate = useCallback(
    async <T,>(fn: (db: GymDB) => Promise<T>): Promise<MutationResult<T>> => {
      if (state.status !== 'ready') return { ok: false, error: 'Still loading' };
      try {
        const data = await fn(state.db);
        state.engine.schedule();
        return { ok: true, data };
      } catch (error) {
        if (error instanceof LocalError) return { ok: false, error: error.message };
        throw error;
      }
    },
    [state],
  );

  const boot = useMemo(() => ({ state, retry: () => setAttempt((n) => n + 1) }), [state]);
  const local = useMemo(() => (state.status === 'ready' ? { ...state, mutate } : null), [state, mutate]);

  return (
    <BootContext value={boot}>
      <LocalContext value={local}>{children}</LocalContext>
    </BootContext>
  );
}

const noopSubscribe = () => () => {};

export function useBoot() {
  return use(BootContext);
}

/** The open local database and sync engine. Only for components rendered once ready. */
export function useLocal(): LocalContextValue {
  const value = use(LocalContext);
  if (!value) throw new Error('useLocal outside a ready LocalDataProvider');
  return value;
}

/** A live query on the local database: re-runs when the data it read changes. */
export function useLocalQuery<T>(query: (db: GymDB) => Promise<T>, deps: unknown[]): T | undefined {
  const { db } = useLocal();
  return useLiveQuery(() => query(db), [db, ...deps]);
}

export function useSyncState(): SyncState {
  const { engine } = useLocal();
  return useSyncExternalStore(engine.subscribe, engine.getState, engine.getState);
}

/** Records with changes waiting to sync, records the server rejected, and conflicts to review. */
export type QueueCounts = { pending: number; failed: number; conflicts: number };

export function useQueueCounts(): QueueCounts | undefined {
  return useLocalQuery(
    async (db) => {
      const [entries, conflicts] = await Promise.all([db.outbox.toArray(), db.conflicts.count()]);
      // Records, not queue entries: several edits to one set count once.
      const records = (status: string) =>
        new Set(entries.filter((e) => e.status === status).map((e) => `${e.entity}:${e.entityId}`)).size;
      return { pending: records('pending'), failed: records('failed'), conflicts };
    },
    [],
  );
}
