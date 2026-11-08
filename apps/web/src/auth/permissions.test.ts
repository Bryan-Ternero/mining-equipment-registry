import { describe, expect, it } from 'vitest';
import { can, roleLabel } from './permissions';
import { parseSession } from './session';

describe('can', () => {
  it('gives both roles reading, hourmeter updates and maintenance', () => {
    for (const role of ['SUPERVISOR', 'OPERADOR'] as const) {
      expect(can(role, 'registerMaintenance')).toBe(true);
      expect(can(role, 'updateHourmeter')).toBe(true);
    }
  });

  it('keeps creating, deleting and changing code or type for the supervisor', () => {
    for (const action of ['createEquipment', 'deleteEquipment', 'editIdentity'] as const) {
      expect(can('SUPERVISOR', action)).toBe(true);
      expect(can('OPERADOR', action)).toBe(false);
    }
  });

  it('labels the roles for the interface', () => {
    expect(roleLabel('SUPERVISOR')).toBe('Supervisor');
    expect(roleLabel('OPERADOR')).toBe('Operador');
  });
});

describe('parseSession', () => {
  const now = Date.UTC(2026, 10, 8, 12);
  const valid = { token: 'a.b', expiresAt: '2026-11-08T20:00:00.000Z', user: { username: 'jefe', role: 'SUPERVISOR' } };

  it('restores a stored session that has not expired', () => {
    expect(parseSession(JSON.stringify(valid), now)).toEqual(valid);
  });

  it('drops an expired, malformed or tampered stored session', () => {
    expect(parseSession(JSON.stringify({ ...valid, expiresAt: '2026-11-08T11:00:00.000Z' }), now)).toBeNull();
    expect(parseSession('not json', now)).toBeNull();
    expect(parseSession(null, now)).toBeNull();
    expect(parseSession(JSON.stringify({ ...valid, user: { username: 'x', role: 'ADMIN' } }), now)).toBeNull();
    expect(parseSession(JSON.stringify({ ...valid, expiresAt: 'not a date' }), now)).toBeNull();
  });
});
