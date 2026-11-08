/**
 * Maintenance rule of the registry.
 *
 * Every equipment type has an interval in hours. The current cycle starts at the hourmeter
 * reading of the last service (0 until the first one). When the hours used in the cycle reach
 * the interval, the equipment "Requiere mantenimiento". Registering a service sets the start of
 * the cycle to the current reading, which restarts it.
 *
 * The status is always derived from these numbers and never stored, so it cannot get out of
 * sync with the hourmeter or the service history.
 */

export interface CycleInput {
  hourmeter: number;
  lastServiceHours: number;
  intervalHours: number;
}

export interface MaintenanceStatus {
  hoursSinceService: number;
  hoursUntilMaintenance: number;
  requiresMaintenance: boolean;
}

/** hourmeter values carry one decimal; rounding removes float noise such as 0.19999999 */
export function roundHours(value: number): number {
  return Math.round(value * 10) / 10;
}

export function maintenanceStatus({ hourmeter, lastServiceHours, intervalHours }: CycleInput): MaintenanceStatus {
  const hoursSinceService = roundHours(hourmeter - lastServiceHours);
  return {
    hoursSinceService,
    hoursUntilMaintenance: roundHours(Math.max(0, intervalHours - hoursSinceService)),
    // inclusive: "si un equipo lo alcanza"
    requiresMaintenance: hoursSinceService >= intervalHours,
  };
}
