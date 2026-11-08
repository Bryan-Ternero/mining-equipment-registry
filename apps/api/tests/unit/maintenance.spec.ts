import { describe, expect, it } from 'vitest';
import { maintenanceStatus } from '../../src/domain/maintenance.js';

describe('maintenanceStatus', () => {
  it('does not require maintenance before the interval is reached', () => {
    expect(maintenanceStatus({ hourmeter: 249.9, lastServiceHours: 0, intervalHours: 250 })).toEqual({
      hoursSinceService: 249.9,
      hoursUntilMaintenance: 0.1,
      requiresMaintenance: false,
    });
  });

  it('requires maintenance exactly when the interval is reached ("lo alcanza")', () => {
    const status = maintenanceStatus({ hourmeter: 250, lastServiceHours: 0, intervalHours: 250 });
    expect(status.requiresMaintenance).toBe(true);
    expect(status.hoursUntilMaintenance).toBe(0);
  });

  it('keeps requiring maintenance past the interval and never reports negative hours left', () => {
    const status = maintenanceStatus({ hourmeter: 400, lastServiceHours: 0, intervalHours: 250 });
    expect(status.requiresMaintenance).toBe(true);
    expect(status.hoursUntilMaintenance).toBe(0);
    expect(status.hoursSinceService).toBe(400);
  });

  it('counts the cycle from the last service, so a service restarts it', () => {
    expect(maintenanceStatus({ hourmeter: 530, lastServiceHours: 280, intervalHours: 250 })).toEqual({
      hoursSinceService: 250,
      hoursUntilMaintenance: 0,
      requiresMaintenance: true,
    });
    expect(maintenanceStatus({ hourmeter: 300, lastServiceHours: 280, intervalHours: 250 })).toEqual({
      hoursSinceService: 20,
      hoursUntilMaintenance: 230,
      requiresMaintenance: false,
    });
  });

  it('avoids floating point noise on one-decimal readings', () => {
    const status = maintenanceStatus({ hourmeter: 100.3, lastServiceHours: 100.1, intervalHours: 250 });
    expect(status.hoursSinceService).toBe(0.2);
    expect(status.hoursUntilMaintenance).toBe(249.8);
  });
});
