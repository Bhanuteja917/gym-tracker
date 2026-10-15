import { execFileSync } from 'node:child_process';

/** Brings the test database up to date with the migrations before any test runs. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    console.warn('TEST_DATABASE_URL is not set: skipping database tests.');
    return;
  }
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: url },
    stdio: 'ignore',
  });
}
