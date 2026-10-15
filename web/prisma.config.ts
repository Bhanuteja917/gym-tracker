import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// The CLI (migrations) uses the direct connection: Neon's pooled endpoint
// doesn't support everything `prisma migrate` needs. The app uses DATABASE_URL.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
  },
});
