import { execSync } from 'node:child_process';

/**
 * Brings the test database up to date with the migrations, the same command production runs.
 * It is non-destructive: each test removes its own rows (see helpers.ts).
 */
export default function setup() {
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
  });
}
