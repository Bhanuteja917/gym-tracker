import { prisma } from '@/server/db';

export const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);

/** Deletes all rows. Only ever runs against TEST_DATABASE_URL. */
export async function resetDb() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "exercise_set", "workout_exercise", "workout", "exercise", "session", "account", "verification", "rate_limit", "user" CASCADE',
  );
}

let n = 0;
export async function createUser(name = 'Test') {
  n += 1;
  return prisma.user.create({
    data: { id: `user-${n}-${Date.now()}`, name, email: `user${n}-${Date.now()}@example.com` },
  });
}
