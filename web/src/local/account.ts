/**
 * Which account's on-device database to open. The session cookie can't be
 * read from JavaScript, so the app remembers the last account the server
 * confirmed. This only picks a local database; it never authorizes anything
 * (every sync request is checked against the session on the server).
 */
import Dexie from 'dexie';

import { userDbName } from './db';

export type StoredAccount = { id: string; email: string; name: string };

const ACCOUNT_KEY = 'gym:account';
/** An account signed out with changes not yet synced; shown on the sign-in page. */
const UNSYNCED_KEY = 'gym:unsynced';

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode): the app re-asks the server on each launch.
  }
}

export const getStoredAccount = () => read<StoredAccount>(ACCOUNT_KEY);
export const setStoredAccount = (account: StoredAccount | null) => write(ACCOUNT_KEY, account);

export type UnsyncedAccount = { email: string; count: number };
export const getUnsyncedAccount = () => read<UnsyncedAccount>(UNSYNCED_KEY);
export const setUnsyncedAccount = (value: UnsyncedAccount | null) => write(UNSYNCED_KEY, value);

/** Deletes an account's on-device database (after sign-out with everything synced). */
export function deleteLocalData(userId: string): Promise<void> {
  return Dexie.delete(userDbName(userId));
}
