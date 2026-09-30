import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { db } from '@/db/client';
import type { DB } from '@/db/types';

let version = 0;
const subscribers = new Set<() => void>();
let scheduled = false;

// One native listener for the whole app. A burst of row changes (e.g. a
// delete that cascades) is coalesced into a single re-render.
addDatabaseChangeListener(() => {
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => {
    scheduled = false;
    version++;
    subscribers.forEach((notify) => notify());
  }, 0);
});

function run<T>(query: (db: DB) => T, _version: number): T {
  return query(db);
}

/**
 * Runs a synchronous query and re-runs it whenever the database changes.
 * Queries are small and local, so running them during render is fine.
 * `version` is passed through so memoization (React Compiler) re-runs the
 * query after every change, not only when the query closure changes.
 */
export function useDbQuery<T>(query: (db: DB) => T): T {
  const [seen, setSeen] = useState(version);

  useEffect(() => {
    const notify = () => setSeen(version);
    subscribers.add(notify);
    notify(); // catch changes between first render and subscribing
    return () => {
      subscribers.delete(notify);
    };
  }, []);

  return run(query, seen);
}
