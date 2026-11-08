import { describe, expect, it } from 'vitest';
import { app, createEquipment, db } from './helpers.js';

describe('equipment types', () => {
  it('lists the three types with their maintenance interval', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/equipment-types' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([
      { code: 'CAMION', name: 'Camión', maintenanceIntervalHours: 250 },
      { code: 'EXCAVADORA', name: 'Excavadora', maintenanceIntervalHours: 500 },
      { code: 'PERFORADORA', name: 'Perforadora', maintenanceIntervalHours: 300 },
    ]);
  });
});

describe('equipment CRUD', () => {
  it('creates an equipment, normalizing the code, and persists it', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/equipment',
      payload: { code: '  cam-001 ', typeCode: 'CAMION', hourmeter: 120.5 },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      code: 'CAM-001',
      typeCode: 'CAMION',
      typeName: 'Camión',
      intervalHours: 250,
      hourmeter: 120.5,
      lastServiceHours: 0,
      hoursSinceService: 120.5,
      hoursUntilMaintenance: 129.5,
      requiresMaintenance: false,
    });
    const stored = await db.equipment.findUniqueOrThrow({ where: { code: 'CAM-001' } });
    expect(stored.hourmeter.toNumber()).toBe(120.5);
  });

  it('rejects invalid input with 400 and lists every field problem, writing nothing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/equipment',
      payload: { code: '', typeCode: 'GRUA', hourmeter: -1 },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details.map((d: { field: string }) => d.field).sort()).toEqual(['code', 'hourmeter', 'typeCode']);
    expect(await db.equipment.count()).toBe(0);
  });

  it('rejects a duplicated code with 409, case-insensitively', async () => {
    await createEquipment({ code: 'EXC-01', typeCode: 'EXCAVADORA', hourmeter: 0 });
    const res = await app.inject({
      method: 'POST',
      url: '/api/equipment',
      payload: { code: 'exc-01', typeCode: 'CAMION', hourmeter: 0 },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('CONFLICT');
    expect(await db.equipment.count()).toBe(1);
  });

  it('lists equipment ordered by code', async () => {
    await createEquipment({ code: 'PER-02', typeCode: 'PERFORADORA', hourmeter: 10 });
    await createEquipment({ code: 'CAM-01', typeCode: 'CAMION', hourmeter: 20 });
    const res = await app.inject({ method: 'GET', url: '/api/equipment' });
    expect(res.statusCode).toBe(200);
    expect(res.json().map((e: { code: string }) => e.code)).toEqual(['CAM-01', 'PER-02']);
  });

  it('gets one equipment, 404 when it does not exist and 400 for a malformed id', async () => {
    const created = await createEquipment({ code: 'CAM-02', typeCode: 'CAMION', hourmeter: 0 });
    expect((await app.inject({ method: 'GET', url: `/api/equipment/${created.id}` })).json().code).toBe('CAM-02');

    const missing = await app.inject({ method: 'GET', url: '/api/equipment/00000000-0000-4000-8000-000000000000' });
    expect(missing.statusCode).toBe(404);
    const malformed = await app.inject({ method: 'GET', url: '/api/equipment/abc' });
    expect(malformed.statusCode).toBe(400);
  });

  it('edits code, type and hourmeter, recalculating the warning with the new interval', async () => {
    const created = await createEquipment({ code: 'X-1', typeCode: 'EXCAVADORA', hourmeter: 260 });
    expect(created.requiresMaintenance).toBe(false);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/equipment/${created.id}`,
      payload: { code: 'CAM-09', typeCode: 'CAMION' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ code: 'CAM-09', typeCode: 'CAMION', hourmeter: 260, requiresMaintenance: true });

    const hours = await app.inject({ method: 'PATCH', url: `/api/equipment/${created.id}`, payload: { hourmeter: 100 } });
    expect(hours.json()).toMatchObject({ hourmeter: 100, requiresMaintenance: false });
  });

  it('rejects an empty edit and an edit to a duplicated code', async () => {
    const a = await createEquipment({ code: 'A-1', typeCode: 'CAMION', hourmeter: 0 });
    await createEquipment({ code: 'B-1', typeCode: 'CAMION', hourmeter: 0 });

    const empty = await app.inject({ method: 'PATCH', url: `/api/equipment/${a.id}`, payload: {} });
    expect(empty.statusCode).toBe(400);
    const dup = await app.inject({ method: 'PATCH', url: `/api/equipment/${a.id}`, payload: { code: 'b-1' } });
    expect(dup.statusCode).toBe(409);
    expect((await db.equipment.findUniqueOrThrow({ where: { id: a.id } })).code).toBe('A-1');
  });

  it('deletes an equipment and its history; a second delete is 404', async () => {
    const created = await createEquipment({ code: 'DEL-1', typeCode: 'CAMION', hourmeter: 300 });
    await app.inject({ method: 'POST', url: `/api/equipment/${created.id}/maintenances`, payload: {} });

    const res = await app.inject({ method: 'DELETE', url: `/api/equipment/${created.id}` });
    expect(res.statusCode).toBe(204);
    expect(await db.equipment.count()).toBe(0);
    expect(await db.maintenanceRecord.count()).toBe(0);

    const again = await app.inject({ method: 'DELETE', url: `/api/equipment/${created.id}` });
    expect(again.statusCode).toBe(404);
  });
});
