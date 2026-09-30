import { eq } from 'drizzle-orm';

import { exercises } from '@/db/schema';
import type { DB } from '@/db/types';
import { createTestDb } from '@/test/test-db';

import { getGymDays } from './attendance';
import { addExerciseToSession, finishSession, logSet, startSession } from './workouts';

let db: DB;
beforeEach(() => {
  db = createTestDb();
});

const at = (m: number, day: number, h = 18) => new Date(2026, m - 1, day, h).getTime();

/** Logs a finished workout with one set, started at `start`. */
function workout(start: number, { finish = true } = {}) {
  const s = startSession(db, start);
  const bench = db.select().from(exercises).where(eq(exercises.name, 'Bench Press')).get()!;
  const se = addExerciseToSession(db, s.id, bench.id);
  logSet(db, se.id, { weight: 135, unit: 'lb', reps: 5 }, start + 60_000);
  if (finish) finishSession(db, s.id, start + 3_600_000);
  return s;
}

describe('getGymDays', () => {
  it('returns each local day with a finished workout once', () => {
    workout(at(9, 1, 7));
    workout(at(9, 1, 19)); // second workout the same day
    workout(at(9, 3));
    expect([...getGymDays(db, at(8, 1))].sort()).toEqual(['2026-09-01', '2026-09-03']);
  });

  it('ignores a workout still in progress', () => {
    workout(at(9, 2));
    workout(at(9, 5), { finish: false });
    expect([...getGymDays(db, at(8, 1))]).toEqual(['2026-09-02']);
  });

  it('only includes workouts started on or after the range start', () => {
    workout(at(8, 31, 23));
    workout(at(9, 1, 0));
    expect([...getGymDays(db, at(9, 1, 0))]).toEqual(['2026-09-01']);
  });

  it('excludes workouts started at or after the optional end', () => {
    workout(at(9, 30, 23));
    workout(at(10, 1, 0));
    expect([...getGymDays(db, at(9, 1), at(10, 1, 0))]).toEqual(['2026-09-30']);
  });

  it('counts a workout on the day it started, even if it ends after midnight', () => {
    workout(at(9, 10, 23)); // finishes 00:00 on the 11th
    expect([...getGymDays(db, at(9, 1))]).toEqual(['2026-09-10']);
  });
});
