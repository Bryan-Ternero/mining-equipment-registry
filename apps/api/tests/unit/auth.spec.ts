import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/auth/password.js';
import { signToken, verifyToken } from '../../src/auth/tokens.js';

describe('password hashing', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('Faena-2026');
    expect(hash).toMatch(/^scrypt:16384:8:1:[\w-]+:[\w-]+$/);
    expect(hash).not.toContain('Faena-2026');
    expect(await verifyPassword('Faena-2026', hash)).toBe(true);
    expect(await verifyPassword('faena-2026', hash)).toBe(false);
  });

  it('salts every hash', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });

  it('rejects a malformed stored hash instead of throwing', async () => {
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('x', '')).toBe(false);
  });
});

describe('session tokens', () => {
  const secret = 'a'.repeat(32);
  const now = Date.UTC(2026, 10, 8, 12, 0, 0);

  it('round-trips the user and role until it expires', () => {
    const { token, expiresAt } = signToken({ username: 'jefe', role: 'SUPERVISOR' }, secret, now);
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(now);
    expect(verifyToken(token, secret, now)).toEqual({ username: 'jefe', role: 'SUPERVISOR' });
    expect(verifyToken(token, secret, new Date(expiresAt).getTime() + 1)).toBeNull();
  });

  it('rejects a token signed with another secret or tampered with', () => {
    const { token } = signToken({ username: 'op', role: 'OPERADOR' }, secret, now);
    expect(verifyToken(token, 'b'.repeat(32), now)).toBeNull();

    const [payload, signature] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ username: 'op', role: 'SUPERVISOR', exp: now + 1e9 })).toString(
      'base64url',
    );
    expect(verifyToken(`${forged}.${signature}`, secret, now)).toBeNull();
    expect(verifyToken(`${payload}.`, secret, now)).toBeNull();
    expect(verifyToken('garbage', secret, now)).toBeNull();
  });
});
