import { execSync } from 'node:child_process';

/**
 * Pone al día la base de datos de tests con las migraciones, el mismo comando que ejecuta producción.
 * No es destructivo: cada test elimina sus propias filas (ver helpers.ts).
 */
export default function setup() {
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
  });
}
