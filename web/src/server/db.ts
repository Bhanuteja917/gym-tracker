
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../generated/prisma/client';

function createClient() {
  // A build without a database (e.g. a preview) imports this module without
  // querying; queries then fail, naming the missing setting.
  const connectionString = process.env.DATABASE_URL ?? 'postgresql://DATABASE_URL-is-not-set.invalid/db';
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

// Reuse one client per process; in dev, survive hot reloads.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export type DB = PrismaClient;
