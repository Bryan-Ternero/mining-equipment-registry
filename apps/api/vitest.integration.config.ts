import { defineConfig } from 'vitest/config';

// Integration tests run against a real PostgreSQL (TEST_DATABASE_URL), never the dev database.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL is not set (see .env.example).');
}

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.spec.ts'],
    globalSetup: ['tests/integration/global-setup.ts'],
    env: { DATABASE_URL: testDatabaseUrl },
    // the suites share one database: run files one after another
    fileParallelism: false,
  },
});
