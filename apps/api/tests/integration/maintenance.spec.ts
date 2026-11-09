import { describe, expect, it } from 'vitest';
import { createEquipment, db, inject } from './helpers.js';

const register = (id: string, payload: Record<string, unknown> = {}) =>
  inject({ method: 'POST', url: `/api/equipment/${id}/maintenances`, payload });

describe('maintenance warning', () => {
  it('shows "Requiere mantenimiento" exactly when the hourmeter reaches the type interval', async () => {
    const truck = await createEquipment({ code: 'CAM-1', typeCode: 'CAMION', hourmeter: 249.9 });
    expect(truck.requiresMaintenance).toBe(false);

    const reached = await inject({ method: 'PATCH', url: `/api/equipment/${truck.id}`, payload: { hourmeter: 250 } });
    expect(reached.json()).toMatchObject({ requiresMaintenance: true, hoursUntilMaintenance: 0 });

    // cada tipo tiene su propio intervalo: 300 h requiere mantenimiento en una perforadora, no en una excavadora
    const drill = await createEquipment({ code: 'PER-1', typeCode: 'PERFORADORA', hourmeter: 300 });
    const excavator = await createEquipment({ code: 'EXC-1', typeCode: 'EXCAVADORA', hourmeter: 300 });
    expect(drill.requiresMaintenance).toBe(true);
    expect(excavator.requiresMaintenance).toBe(false);
  });
});

describe('equipment details: last maintenance and count', () => {
  it('starts with no last maintenance and a count of 0', async () => {
    const truck = await createEquipment({ code: 'CAM-DET0', typeCode: 'CAMION', hourmeter: 10 });
    expect(truck).toMatchObject({ lastMaintenance: null, maintenanceCount: 0 });
    expect(typeof truck.createdAt).toBe('string');
  });

  it('returns the latest service (by date) and the count, in the list and after registering', async () => {
    const truck = await createEquipment({ code: 'CAM-DET', typeCode: 'CAMION', hourmeter: 0 });
    await register(truck.id, { hourmeter: 250, performedAt: '2026-10-01T10:00:00Z', notes: 'Primer servicio' });
    const second = await register(truck.id, { hourmeter: 500, performedAt: '2026-11-01T10:00:00Z', notes: 'Cambio de aceite' });

    // the registration answer already carries the new last maintenance
    expect(second.json().equipment).toMatchObject({
      maintenanceCount: 2,
      lastMaintenance: { hourmeter: 500, notes: 'Cambio de aceite', performedBy: 'jefe', performedAt: '2026-11-01T10:00:00.000Z' },
    });

    // un registro más antiguo cargado después (directo en la base) no debe desplazar al más reciente:
    // el "último" se elige por fecha, no por orden de carga
    await db.maintenanceRecord.create({
      data: { equipmentId: truck.id, hourmeter: 100, performedAt: new Date('2026-09-01T10:00:00Z'), notes: 'Carga tardía' },
    });

    const list = await inject({ method: 'GET', url: '/api/equipment' });
    const row = list.json().find((e: { code: string }) => e.code === 'CAM-DET');
    expect(row).toMatchObject({ maintenanceCount: 3, lastMaintenance: { hourmeter: 500, notes: 'Cambio de aceite' } });
  });
});

describe('registering a maintenance', () => {
  it('leaves history and restarts the cycle from the current reading', async () => {
    const truck = await createEquipment({ code: 'CAM-2', typeCode: 'CAMION', hourmeter: 280 });
    expect(truck.requiresMaintenance).toBe(true);

    const res = await register(truck.id, { notes: 'Cambio de aceite' });
    expect(res.statusCode).toBe(201);
    const { maintenance, equipment } = res.json();
    expect(maintenance).toMatchObject({ equipmentId: truck.id, hourmeter: 280, notes: 'Cambio de aceite' });
    expect(equipment).toMatchObject({
      hourmeter: 280,
      lastServiceHours: 280,
      hoursSinceService: 0,
      hoursUntilMaintenance: 250,
      requiresMaintenance: false,
    });

    // el nuevo ciclo dura un intervalo completo: vuelve a requerir mantenimiento en 280 + 250 = 530
    const before = await inject({ method: 'PATCH', url: `/api/equipment/${truck.id}`, payload: { hourmeter: 529.9 } });
    expect(before.json().requiresMaintenance).toBe(false);
    const due = await inject({ method: 'PATCH', url: `/api/equipment/${truck.id}`, payload: { hourmeter: 530 } });
    expect(due.json().requiresMaintenance).toBe(true);

    const stored = await db.maintenanceRecord.findMany({ where: { equipmentId: truck.id } });
    expect(stored).toHaveLength(1);
  });

  it('stores the date and time, the comments and who performed it, and returns them in the history', async () => {
    const truck = await createEquipment({ code: 'CAM-WHO', typeCode: 'CAMION', hourmeter: 250 });
    const res = await inject(
      {
        method: 'POST',
        url: `/api/equipment/${truck.id}/maintenances`,
        payload: { performedAt: '2026-11-07T14:35:00-03:00', notes: 'Cambio de aceite y filtros' },
      },
      'OPERADOR',
    );
    expect(res.statusCode).toBe(201);
    expect(res.json().maintenance).toMatchObject({
      performedAt: '2026-11-07T17:35:00.000Z',
      notes: 'Cambio de aceite y filtros',
      performedBy: 'operador',
    });

    const stored = await db.maintenanceRecord.findFirstOrThrow({ where: { equipmentId: truck.id } });
    expect(stored.performedBy).toBe('operador');

    const history = await inject({ method: 'GET', url: `/api/equipment/${truck.id}/maintenances` });
    expect(history.json()[0]).toMatchObject({ performedBy: 'operador', notes: 'Cambio de aceite y filtros' });
  });

  it('accepts a reading above the hourmeter and moves the hourmeter to it', async () => {
    const truck = await createEquipment({ code: 'CAM-3', typeCode: 'CAMION', hourmeter: 240 });
    const res = await register(truck.id, { hourmeter: 255.5, performedAt: '2026-11-01T10:00:00Z' });
    expect(res.statusCode).toBe(201);
    expect(res.json().equipment).toMatchObject({ hourmeter: 255.5, lastServiceHours: 255.5 });
    expect(res.json().maintenance.performedAt).toBe('2026-11-01T10:00:00.000Z');
  });

  it('rejects a reading below the hourmeter and a future date, writing nothing', async () => {
    const truck = await createEquipment({ code: 'CAM-4', typeCode: 'CAMION', hourmeter: 300 });

    const lower = await register(truck.id, { hourmeter: 299 });
    expect(lower.statusCode).toBe(400);
    const future = await register(truck.id, { performedAt: '2999-01-01T00:00:00Z' });
    expect(future.statusCode).toBe(400);

    expect(await db.maintenanceRecord.count()).toBe(0);
    const stored = await db.equipment.findUniqueOrThrow({ where: { id: truck.id } });
    expect(stored.lastServiceHours.toNumber()).toBe(0);
  });

  it('rejects a service dated before the last registered one', async () => {
    const truck = await createEquipment({ code: 'CAM-7', typeCode: 'CAMION', hourmeter: 0 });
    await register(truck.id, { hourmeter: 250, performedAt: '2026-11-01T00:00:00Z' });

    const older = await register(truck.id, { hourmeter: 260, performedAt: '2026-10-01T00:00:00Z' });
    expect(older.statusCode).toBe(400);
    expect(older.json().error.details[0].field).toBe('performedAt');
    expect(await db.maintenanceRecord.count({ where: { equipmentId: truck.id } })).toBe(1);
  });

  it('serializes concurrent services so the hourmeter never ends below the history', async () => {
    for (let round = 0; round < 5; round++) {
      const truck = await createEquipment({ code: `RACE-${round}`, typeCode: 'CAMION', hourmeter: 300 });
      await Promise.all([register(truck.id, { hourmeter: 310 }), register(truck.id, { hourmeter: 305 })]);

      const stored = await db.equipment.findUniqueOrThrow({ where: { id: truck.id } });
      const highest = await db.maintenanceRecord.aggregate({ where: { equipmentId: truck.id }, _max: { hourmeter: true } });
      expect(stored.hourmeter.toNumber()).toBe(highest._max.hourmeter?.toNumber());
      expect(stored.lastServiceHours.toNumber()).toBe(stored.hourmeter.toNumber());
    }
  });

  it('does not let the hourmeter be edited below the last service reading', async () => {
    const truck = await createEquipment({ code: 'CAM-5', typeCode: 'CAMION', hourmeter: 300 });
    await register(truck.id);

    const res = await inject({ method: 'PATCH', url: `/api/equipment/${truck.id}`, payload: { hourmeter: 299.9 } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.details[0].field).toBe('hourmeter');
    expect((await db.equipment.findUniqueOrThrow({ where: { id: truck.id } })).hourmeter.toNumber()).toBe(300);
  });

  it('lists the history newest first and 404s for an unknown equipment', async () => {
    const truck = await createEquipment({ code: 'CAM-6', typeCode: 'CAMION', hourmeter: 0 });
    await register(truck.id, { hourmeter: 250, performedAt: '2026-10-01T00:00:00Z' });
    await register(truck.id, { hourmeter: 500, performedAt: '2026-11-01T00:00:00Z' });

    const res = await inject({ method: 'GET', url: `/api/equipment/${truck.id}/maintenances` });
    expect(res.statusCode).toBe(200);
    expect(res.json().map((m: { hourmeter: number }) => m.hourmeter)).toEqual([500, 250]);

    const missing = await inject({
      method: 'GET',
      url: '/api/equipment/00000000-0000-4000-8000-000000000000/maintenances',
    });
    expect(missing.statusCode).toBe(404);
    const missingPost = await register('00000000-0000-4000-8000-000000000000');
    expect(missingPost.statusCode).toBe(404);
  });
});
