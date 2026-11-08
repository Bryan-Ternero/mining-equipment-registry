import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach } from 'vitest';
import { buildApp } from '../../src/app.js';

export const db = new PrismaClient();
export const app = buildApp({
  config: { port: 0, webOrigins: ['http://localhost:5173'], version: 'test-version' },
  db,
});

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
  const res = await app.inject({ method: 'POST', url: '/api/equipment', payload: body });
  if (res.statusCode !== 201) throw new Error(`create failed: ${res.statusCode} ${res.body}`);
  return res.json();
}
