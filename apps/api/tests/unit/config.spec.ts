import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config.js';

const valid = {
  DATABASE_URL: 'postgresql://x',
  AUTH_TOKEN_SECRET: 's'.repeat(32),
  AUTH_SUPERVISOR_USERNAME: 'Jefe',
  AUTH_SUPERVISOR_PASSWORD_HASH: 'scrypt:16384:8:1:a:b',
  AUTH_OPERATOR_USERNAME: 'operador',
  AUTH_OPERATOR_PASSWORD_HASH: 'scrypt:16384:8:1:c:d',
};

describe('loadConfig', () => {
  it('reads both accounts with their roles, usernames lowercased', () => {
    const config = loadConfig({ ...valid, WEB_ORIGIN: 'https://a.example/, https://b.example' });
    expect(config.auth.accounts.map((a) => [a.username, a.role])).toEqual([
      ['jefe', 'SUPERVISOR'],
      ['operador', 'OPERADOR'],
    ]);
    expect(config.webOrigins).toEqual(['https://a.example', 'https://b.example']);
  });

  it('lists every missing variable in one error', () => {
    expect(() => loadConfig({ DATABASE_URL: 'x' })).toThrow(
      /AUTH_TOKEN_SECRET, AUTH_SUPERVISOR_USERNAME, AUTH_SUPERVISOR_PASSWORD_HASH, AUTH_OPERATOR_USERNAME, AUTH_OPERATOR_PASSWORD_HASH/,
    );
  });

  it('rejects a short secret, a shared username and a plain-text password', () => {
    expect(() => loadConfig({ ...valid, AUTH_TOKEN_SECRET: 'short' })).toThrow(/at least 32/);
    expect(() => loadConfig({ ...valid, AUTH_OPERATOR_USERNAME: 'JEFE' })).toThrow(/must be different/);
    expect(() => loadConfig({ ...valid, AUTH_OPERATOR_PASSWORD_HASH: 'secret123' })).toThrow(/auth:hash/);
  });
});
