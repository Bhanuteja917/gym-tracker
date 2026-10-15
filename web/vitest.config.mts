import 'dotenv/config';

import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      // `server-only` throws outside a React Server environment.
      'server-only': path.resolve(import.meta.dirname, 'test/server-only-stub.ts'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    env: {
      // Integration tests run against a database they may wipe; never DATABASE_URL.
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? '',
    },
    fileParallelism: false,
  },
});
