import { describe, expect, it } from 'vitest';
import type { Equipment } from './api';
import { equipmentDetails, formatRelative } from './details';

const now = new Date('2026-11-09T12:00:00Z').getTime();

describe('formatRelative', () => {
  it('describe cuánto tiempo pasó en minutos, horas o días', () => {
    expect(formatRelative('2026-11-09T11:59:40Z', now)).toBe('hace un momento');
    expect(formatRelative('2026-11-09T11:15:00Z', now)).toBe('hace 45 min');
    expect(formatRelative('2026-11-09T10:00:00Z', now)).toBe('hace 2 h');
    expect(formatRelative('2026-11-08T11:00:00Z', now)).toBe('hace 1 día');
    expect(formatRelative('2026-11-02T12:00:00Z', now)).toBe('hace 7 días');
  });
});

const base: Equipment = {
  id: 'e1',
  code: 'CAM-001',
  typeCode: 'CAMION',
  typeName: 'Camión',
  intervalHours: 250,
  hourmeter: 300,
  lastServiceHours: 280,
  hoursSinceService: 20,
  hoursUntilMaintenance: 230,
  requiresMaintenance: false,
  lastMaintenance: {
    id: 'm1',
    equipmentId: 'e1',
    hourmeter: 280,
    performedAt: '2026-11-08T14:35:00Z',
    notes: 'Cambio de aceite',
    performedBy: 'operador',
    createdAt: '2026-11-08T14:36:00Z',
  },
  maintenanceCount: 3,
  createdAt: '2026-11-01T09:00:00Z',
  updatedAt: '2026-11-09T10:00:00Z',
};

describe('equipmentDetails', () => {
  it('lista los seis datos del equipo con su último mantenimiento', () => {
    const rows = equipmentDetails(base, now);
    expect(rows.map((r) => r.label)).toEqual([
      'Registrado',
      'Último mantenimiento',
      'Comentario',
      'Horómetro en ese servicio',
      'Mantenimientos',
      'Última actualización',
    ]);
    const value = (label: string) => rows.find((r) => r.label === label)?.value;
    expect(value('Último mantenimiento')).toContain('por operador');
    expect(value('Comentario')).toBe('Cambio de aceite');
    expect(value('Horómetro en ese servicio')).toBe('280 h');
    expect(value('Mantenimientos')).toBe('3 registrados');
    expect(value('Última actualización')).toBe('hace 2 h');
  });

  it('indica cuando el equipo todavía no tiene mantenimientos, sin filas vacías', () => {
    const rows = equipmentDetails({ ...base, lastMaintenance: null, maintenanceCount: 0 }, now);
    expect(rows.map((r) => r.label)).toEqual(['Registrado', 'Último mantenimiento', 'Mantenimientos', 'Última actualización']);
    expect(rows.find((r) => r.label === 'Último mantenimiento')?.value).toBe('Sin mantenimientos todavía');
    expect(rows.find((r) => r.label === 'Mantenimientos')?.value).toBe('Ninguno');
  });

  it('omite el comentario y el autor cuando no se registraron', () => {
    const rows = equipmentDetails(
      { ...base, lastMaintenance: { ...base.lastMaintenance!, notes: null, performedBy: null }, maintenanceCount: 1 },
      now,
    );
    expect(rows.some((r) => r.label === 'Comentario')).toBe(false);
    expect(rows.find((r) => r.label === 'Último mantenimiento')?.value).not.toContain('por');
    expect(rows.find((r) => r.label === 'Mantenimientos')?.value).toBe('1 registrado');
  });
});
