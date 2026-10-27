// Creates, or resets, a demo account to share with others: ten weeks of
// Upper/Lower workouts with steady progress, a weekly plan, and attendance.
//
//   npm run demo:reset                       (uses DATABASE_URL from .env)
//   DEMO_PASSWORD='…' npm run demo:reset     (keep the password you shared)
//
// DEMO_EMAIL defaults to demo@example.com. Without DEMO_PASSWORD a new one is
// generated and printed. Rows are written directly, so ALLOWED_EMAILS doesn't
// block the account. A reset deletes the old account first (signing out every
// device using it) and creates it under a new id, so devices start with a
// fresh local database instead of keeping what visitors logged.
import { randomBytes, randomUUID } from 'node:crypto';

import { hashPassword } from 'better-auth/crypto';
import pg from 'pg';

const EMAIL = (process.env.DEMO_EMAIL ?? 'demo@example.com').trim().toLowerCase();
const PASSWORD = process.env.DEMO_PASSWORD ?? randomBytes(9).toString('base64url');
const NAME = 'Demo';
const WEEKS = 10;
const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!connectionString) throw new Error('Set DATABASE_URL (or DATABASE_URL_UNPOOLED).');
if (PASSWORD.length < 10) throw new Error('DEMO_PASSWORD must be at least 10 characters.');

// Seeded so every reset logs the same history.
let seed = 917;
const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

// [name, muscle group, start weight in lb (null = bodyweight), lb added per week, rep range]
// Named as in the exercise library, so importing it later reuses these.
const EXERCISES = {
  chestPress: ['Machine Bench Press', 'Chest', 110, 2.5, [6, 10]],
  row: ['Seated Cable Rows', 'Traps (mid-back)', 100, 2.5, [8, 12]],
  ohp: ['Standing Military Press', 'Shoulders', 65, 1.25, [6, 10]],
  pulldown: ['Wide-Grip Lat Pulldown', 'Lats', 110, 2.5, [8, 12]],
  lateral: ['Side Lateral Raise', 'Shoulders', 15, 0.5, [12, 20]],
  curl: ['Barbell Curl', 'Biceps', 45, 1, [8, 12]],
  pushdown: ['Triceps Pushdown', 'Triceps', 40, 1, [10, 15]],
  squat: ['Smith Machine Squat', 'Quads', 135, 5, [6, 10]],
  rdl: ['Romanian Deadlift', 'Hamstrings', 115, 5, [8, 10]],
  legExt: ['Leg Extensions', 'Quads', 90, 2.5, [10, 15]],
  legCurl: ['Lying Leg Curls', 'Hamstrings', 70, 2.5, [10, 15]],
  calf: ['Smith Machine Calf Raise', 'Calves', 135, 5, [8, 12]],
  dips: ['Dips - Triceps Version', 'Triceps', null, 0, [8, 12]],
  plank: ['Plank', 'Abdominals', null, 0, null],
};

// Monday-based weekday (0 = Monday) → [title, [exercise key, sets]].
const DAYS = {
  0: ['Upper A', [['chestPress', 3], ['row', 3], ['ohp', 2], ['lateral', 3], ['curl', 2], ['pushdown', 2]]],
  1: ['Lower A', [['squat', 3], ['rdl', 3], ['legExt', 3], ['calf', 3], ['plank', 2]]],
  3: ['Upper B', [['ohp', 3], ['pulldown', 3], ['chestPress', 2], ['dips', 3], ['lateral', 3], ['curl', 2]]],
  4: ['Lower B', [['rdl', 3], ['squat', 2], ['legCurl', 3], ['legExt', 2], ['calf', 3]]],
};
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const ids = Object.fromEntries(Object.keys(EXERCISES).map((key) => [key, randomUUID()]));

const weeklyPlan = Object.fromEntries(
  WEEKDAYS.map((weekday, i) => {
    const day = DAYS[i];
    if (!day) return [weekday, { title: '', items: [] }];
    const [title, items] = day;
    return [
      weekday,
      {
        title,
        items: items.map(([key, sets]) => {
          const range = EXERCISES[key][4];
          return { exerciseId: ids[key], sets, reps: range ? `${range[0]}–${range[1]}` : '45 s' };
        }),
      },
    ];
  }),
);

/** Rounds to the nearest 2.5 lb, as a gym's plates and stacks go. */
const plate = (lb) => Math.round(lb / 2.5) * 2.5;

/** The workouts of the last WEEKS weeks, up to yesterday, skipping a few days as people do. */
function buildWorkouts() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7) - 7 * (WEEKS - 1));

  const workouts = [];
  for (let week = 0; week < WEEKS; week++) {
    for (const [weekdayIndex, [, items]] of Object.entries(DAYS)) {
      const date = new Date(monday);
      date.setUTCDate(monday.getUTCDate() + week * 7 + Number(weekdayIndex));
      if (date >= today || random() < 0.12) continue;

      // Evenings, 5:30–7:00 pm UTC.
      let time = date.getTime() + (17.5 + Math.floor(random() * 4) * 0.5) * 3600_000;
      const startedAt = new Date(time);
      const exercises = items.map(([key, sets]) => {
        const [, , start, perWeek, range] = EXERCISES[key];
        time += 3 * 60_000;
        return {
          exerciseId: ids[key],
          sets: Array.from({ length: sets }, (_, s) => {
            time += (2 + random() * 1.5) * 60_000;
            const completedAt = new Date(time);
            if (!range) return { weight: null, reps: null, durationSec: 45 + 15 * Math.floor(week / 3), completedAt };
            const [low, high] = range;
            // Double progression: reps climb through the range within each block of weeks.
            const reps = Math.max(low, Math.min(high, low + (week % 4) + Math.round(random() * 2) - s));
            const weight = start === null ? null : plate(start + perWeek * week);
            return { weight, reps, durationSec: null, rpe: s === sets - 1 ? 8 + (random() < 0.5 ? 0.5 : 1) : null, completedAt };
          }),
        };
      });
      workouts.push({ id: randomUUID(), startedAt, endedAt: new Date(time + 5 * 60_000), exercises });
    }
  }
  return workouts;
}

const client = new pg.Client({ connectionString });
await client.connect();
try {
  await client.query('BEGIN');

  const old = await client.query('SELECT id FROM "user" WHERE email = $1', [EMAIL]);
  for (const { id } of old.rows) {
    // workout_exercise → exercise is ON DELETE RESTRICT, so remove children first.
    for (const table of ['exercise_set', 'workout_exercise', 'workout', 'exercise']) {
      await client.query(`DELETE FROM "${table}" WHERE "userId" = $1`, [id]);
    }
    await client.query('DELETE FROM "user" WHERE id = $1', [id]);
  }

  const userId = randomUUID();
  const now = new Date();
  await client.query(
    `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", "defaultUnit", "weeklyPlan")
     VALUES ($1, $2, $3, true, $4, $4, 'lb', $5)`,
    [userId, NAME, EMAIL, now, JSON.stringify(weeklyPlan)],
  );
  await client.query(
    `INSERT INTO "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
     VALUES ($1, $2, 'credential', $2, $3, $4, $4)`,
    [randomUUID(), userId, await hashPassword(PASSWORD), now],
  );

  for (const [key, [name, muscleGroup]] of Object.entries(EXERCISES)) {
    await client.query(
      `INSERT INTO "exercise" (id, "userId", name, "muscleGroup", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $5)`,
      [ids[key], userId, name, muscleGroup, now],
    );
  }

  const workouts = buildWorkouts();
  let setCount = 0;
  for (const workout of workouts) {
    await client.query(
      `INSERT INTO "workout" (id, "userId", "startedAt", "endedAt", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $4, $4)`,
      [workout.id, userId, workout.startedAt, workout.endedAt],
    );
    for (const [position, exercise] of workout.exercises.entries()) {
      const workoutExerciseId = randomUUID();
      await client.query(
        `INSERT INTO "workout_exercise" (id, "userId", "workoutId", "exerciseId", position, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $6)`,
        [workoutExerciseId, userId, workout.id, exercise.exerciseId, position, workout.startedAt],
      );
      for (const [setPosition, set] of exercise.sets.entries()) {
        await client.query(
          `INSERT INTO "exercise_set" (id, "userId", "workoutExerciseId", position, weight, unit, reps, "durationSec", rpe, "completedAt", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, 'lb', $6, $7, $8, $9, $9, $9)`,
          [randomUUID(), userId, workoutExerciseId, setPosition, set.weight, set.reps, set.durationSec, set.rpe ?? null, set.completedAt],
        );
        setCount++;
      }
    }
  }

  await client.query('COMMIT');
  console.log(`Demo account ready: ${workouts.length} workouts, ${setCount} sets.`);
  console.log(`  Email:    ${EMAIL}`);
  console.log(`  Password: ${PASSWORD}`);
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
