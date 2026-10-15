// Vercel build: apply migrations, then build. Migrations run only when the
// deployment has a database (Production, or a Preview pointed at a Neon
// branch); a preview without one still builds, it just can't sync.
import { execSync } from 'node:child_process';

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

if (process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL) {
  run('npx prisma migrate deploy');
} else {
  console.log('No DATABASE_URL: skipping migrations (this deployment has no database).');
}
run('npx next build');
