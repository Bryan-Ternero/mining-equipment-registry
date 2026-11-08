import type { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { app } from './helpers.js';

describe('GET /health', () => {
  it('answers 200 with the database up and the deployed version', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', db: 'up', version: 'test-version' });
  });

  it('answers 503 when the database does not respond', async () => {
    const brokenDb = { $queryRaw: () => Promise.reject(new Error('connection refused')) } as unknown as PrismaClient;
    const broken = buildApp({ config: { port: 0, webOrigins: [], version: 'v' }, db: brokenDb });
    const res = await broken.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ status: 'degraded', db: 'down' });
    await broken.close();
  });

  it('answers CORS preflights for the allowed frontend origin only', async () => {
    const allowed = await app.inject({
      method: 'OPTIONS',
      url: '/api/equipment',
      headers: { origin: 'http://localhost:5173', 'access-control-request-method': 'PATCH' },
    });
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');

    const other = await app.inject({
      method: 'OPTIONS',
      url: '/api/equipment',
      headers: { origin: 'https://evil.example', 'access-control-request-method': 'PATCH' },
    });
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers unknown routes with the common error shape', async () => {
    const res = await app.inject({ method: 'GET', url: '/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });
});
