import { and, gte, isNotNull, lt } from 'drizzle-orm';

import { sessions } from '@/db/schema';
import type { DB } from '@/db/types';
import { dayKey, type DayKey } from '@/lib/dot-grid';

/**
 * Local days with at least one finished workout started in `[from, to)`
 * (`to` optional). A workout counts on the day it started.
 */
export function getGymDays(db: DB, from: number, to?: number): Set<DayKey> {
  const rows = db
    .select({ startedAt: sessions.startedAt })
    .from(sessions)
    .where(
      and(
        isNotNull(sessions.endedAt),
        gte(sessions.startedAt, from),
        to === undefined ? undefined : lt(sessions.startedAt, to),
      ),
    )
    .all();
  return new Set(rows.map((r) => dayKey(r.startedAt)));
}
