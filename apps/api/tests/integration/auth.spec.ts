import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { app, authHeader, config, createEquipment, db, inject, PASSWORDS } from './helpers.js';

const login = (username: string, password: string, ip = '10.0.0.1') =>
  app.inject({ method: 'POST', url: '/api/auth/login', payload: { username, password }, remoteAddress: ip });

describe('login', () => {
  it('returns a token and the role for each account, and /me reads it back', async () => {
    for (const [username, password, role] of [
      ['jefe', PASSWORDS.SUPERVISOR, 'SUPERVISOR'],
      ['operador', PASSWORDS.OPERADOR, 'OPERADOR'],
    ] as const) {
      const res = await login(username, password, `10.1.0.${role.length}`);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.user).toEqual({ username, role });
      expect(typeof body.token).toBe('string');
      expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());

      const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { authorization: `Bearer ${body.token}` } });
      expect(me.statusCode).toBe(200);
      expect(me.json()).toEqual({ username, role });
    }
  });

  it('accepts the username case-insensitively and with spaces', async () => {
    const res = await login('  JEFE ', PASSWORDS.SUPERVISOR, '10.2.0.1');
    expect(res.statusCode).toBe(200);
    expect(res.json().user.username).toBe('jefe');
  });

  it('answers 401 with the same message for a wrong password and an unknown user', async () => {
    const wrong = await login('jefe', 'nope', '10.3.0.1');
    const unknown = await login('nadie', 'nope', '10.3.0.2');
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.json().error.message).toBe(unknown.json().error.message);
  });

  it('answers 400 when fields are missing', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: {}, remoteAddress: '10.4.0.1' });
    expect(res.statusCode).toBe(400);
  });

  it('blocks an address after 5 failed attempts, even with the right password', async () => {
    const throttled = buildApp({ config, db });
    const attempt = (password: string) =>
      throttled.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'jefe', password },
        remoteAddress: '10.9.9.9',
      });
    for (let i = 0; i < 5; i++) expect((await attempt('bad')).statusCode).toBe(401);
    const blocked = await attempt(PASSWORDS.SUPERVISOR);
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
    await throttled.close();
  });

  it('keys the limit on the address the proxy saw, not on a forged X-Forwarded-For', async () => {
    const throttled = buildApp({ config, db });
    // the client forges the leftmost entry; the platform proxy appends the real address last
    const attempt = (i: number, password = 'bad') =>
      throttled.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'jefe', password },
        remoteAddress: '10.20.0.1',
        headers: { 'x-forwarded-for': `203.0.113.${i}, 198.51.100.7` },
      });
    for (let i = 0; i < 5; i++) expect((await attempt(i)).statusCode).toBe(401);
    expect((await attempt(99, PASSWORDS.SUPERVISOR)).statusCode).toBe(429);
    await throttled.close();
  });
});

describe('guard', () => {
  it('rejects every /api route without a valid session, but keeps /health public', async () => {
    for (const [method, url] of [
      ['GET', '/api/equipment'],
      ['GET', '/api/equipment-types'],
      ['POST', '/api/equipment'],
      ['GET', '/api/auth/me'],
    ] as const) {
      const res = await app.inject({ method, url });
      expect(res.statusCode, `${method} ${url}`).toBe(401);
      expect(res.json().error.code).toBe('UNAUTHORIZED');
    }
    const forged = await app.inject({ method: 'GET', url: '/api/equipment', headers: { authorization: 'Bearer abc.def' } });
    expect(forged.statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
  });

  it('cannot be skipped with a percent-encoded path', async () => {
    for (const [method, url] of [
      ['GET', '/%61pi/equipment'],
      ['GET', '/%61pi/equipment-types'],
      ['PATCH', '/%61pi/equipment/00000000-0000-4000-8000-000000000000'],
    ] as const) {
      const res = await app.inject({ method, url, payload: method === 'PATCH' ? { hourmeter: 1 } : undefined });
      expect(res.statusCode, `${method} ${url}`).toBe(401);
    }
  });

  it('still answers CORS preflights without a session', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/api/equipment',
      headers: { origin: 'http://localhost:5173', 'access-control-request-method': 'GET' },
    });
    expect(res.statusCode).toBeLessThan(300);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});

describe('roles', () => {
  it('lets the operator read, update the hourmeter and register maintenance', async () => {
    const truck = await createEquipment({ code: 'CAM-OP', typeCode: 'CAMION', hourmeter: 100 });

    expect((await inject({ method: 'GET', url: '/api/equipment' }, 'OPERADOR')).statusCode).toBe(200);
    const hours = await inject({ method: 'PATCH', url: `/api/equipment/${truck.id}`, payload: { hourmeter: 260 } }, 'OPERADOR');
    expect(hours.statusCode).toBe(200);
    expect(hours.json().hourmeter).toBe(260);
    const service = await inject({ method: 'POST', url: `/api/equipment/${truck.id}/maintenances`, payload: {} }, 'OPERADOR');
    expect(service.statusCode).toBe(201);
  });

  it('forbids the operator to create, delete, recode or retype equipment, changing nothing', async () => {
    const truck = await createEquipment({ code: 'CAM-SUP', typeCode: 'CAMION', hourmeter: 100 });

    const attempts = [
      { method: 'POST', url: '/api/equipment', payload: { code: 'X-1', typeCode: 'CAMION', hourmeter: 0 } },
      { method: 'DELETE', url: `/api/equipment/${truck.id}` },
      { method: 'PATCH', url: `/api/equipment/${truck.id}`, payload: { typeCode: 'EXCAVADORA' } },
      { method: 'PATCH', url: `/api/equipment/${truck.id}`, payload: { code: 'NEW-1' } },
      { method: 'PATCH', url: `/api/equipment/${truck.id}`, payload: { code: 'NEW-1', hourmeter: 120 } },
    ] as const;
    for (const attempt of attempts) {
      const res = await inject(attempt, 'OPERADOR');
      expect(res.statusCode, `${attempt.method} ${JSON.stringify(attempt)}`).toBe(403);
      expect(res.json().error.code).toBe('FORBIDDEN');
    }

    const stored = await db.equipment.findMany();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ code: 'CAM-SUP', typeCode: 'CAMION' });
    expect(stored[0]?.hourmeter.toNumber()).toBe(100);
  });

  it('lets the supervisor do everything', async () => {
    const truck = await createEquipment({ code: 'CAM-ALL', typeCode: 'CAMION', hourmeter: 0 });
    const retype = await inject({ method: 'PATCH', url: `/api/equipment/${truck.id}`, payload: { typeCode: 'EXCAVADORA' } });
    expect(retype.statusCode).toBe(200);
    expect((await app.inject({ method: 'DELETE', url: `/api/equipment/${truck.id}`, headers: authHeader('SUPERVISOR') })).statusCode).toBe(204);
  });
});
