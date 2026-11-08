import { defineConfig } from 'vitest/config';

// Los tests de integración corren contra un PostgreSQL real (TEST_DATABASE_URL), nunca contra la base de desarrollo.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL is not set (see .env.example).');
}

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.spec.ts'],
    globalSetup: ['tests/integration/global-setup.ts'],
    env: { DATABASE_URL: testDatabaseUrl },
    // las suites comparten una sola base de datos: los archivos se ejecutan uno tras otro
    fileParallelism: false,
  },
});
