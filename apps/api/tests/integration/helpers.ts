import { PrismaClient } from '@prisma/client';
import type { InjectOptions } from 'fastify';
import { afterAll, beforeEach } from 'vitest';
import { buildApp } from '../../src/app.js';
import { hashPassword } from '../../src/auth/password.js';
import { signToken, type Role } from '../../src/auth/tokens.js';
import type { Config } from '../../src/config.js';

// the suites delete rows: refuse to run against anything but the dedicated test database
if (!process.env.TEST_DATABASE_URL || process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) {
  throw new Error('Integration tests must run against TEST_DATABASE_URL (npm run test:int).');
}

export const PASSWORDS = { SUPERVISOR: 'Supervisor-Test-1', OPERADOR: 'Operador-Test-1' } as const;

export const config: Config = {
  port: 0,
  webOrigins: ['http://localhost:5173'],
  version: 'test-version',
  auth: {
    tokenSecret: 'test-secret-'.padEnd(40, 'x'),
    accounts: [
      { username: 'jefe', role: 'SUPERVISOR', passwordHash: await hashPassword(PASSWORDS.SUPERVISOR) },
      { username: 'operador', role: 'OPERADOR', passwordHash: await hashPassword(PASSWORDS.OPERADOR) },
    ],
  },
};

export const db = new PrismaClient();
export const app = buildApp({ config, db });

export const USERNAMES: Record<Role, string> = { SUPERVISOR: 'jefe', OPERADOR: 'operador' };

export function authHeader(role: Role) {
  const { token } = signToken({ username: USERNAMES[role], role }, config.auth.tokenSecret);
  return { authorization: `Bearer ${token}` };
}

/** app.inject with a session of the given role (supervisor unless said otherwise) */
export function inject(options: InjectOptions, role: Role = 'SUPERVISOR') {
  return app.inject({ ...options, headers: { ...authHeader(role), ...options.headers } });
}

// every test starts with no equipment; the type catalogue comes from the migration and stays
beforeEach(async () => {
  await db.maintenanceRecord.deleteMany();
  await db.equipment.deleteMany();
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

export async function createEquipment(body: Record<string, unknown>) {
  const res = await inject({ method: 'POST', url: '/api/equipment', payload: body });
  if (res.statusCode !== 201) throw new Error(`create failed: ${res.statusCode} ${res.body}`);
  return res.json();
}
