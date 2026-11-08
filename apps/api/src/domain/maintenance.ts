/**
 * Regla de mantenimiento del registro.
 *
 * Cada tipo de equipo tiene un intervalo en horas. El ciclo actual empieza en la lectura del
 * horómetro del último mantenimiento (0 hasta el primero). Cuando las horas usadas en el ciclo
 * alcanzan el intervalo, el equipo "Requiere mantenimiento". Registrar un mantenimiento fija el
 * inicio del ciclo en la lectura actual, lo que lo reinicia.
 *
 * El estado siempre se deriva de estos números y nunca se guarda, así no puede desincronizarse
 * del horómetro ni del historial de mantenimientos.
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

/** los valores del horómetro llevan un decimal; el redondeo elimina el ruido de punto flotante como 0.19999999 */
export function roundHours(value: number): number {
  return Math.round(value * 10) / 10;
}

export function maintenanceStatus({ hourmeter, lastServiceHours, intervalHours }: CycleInput): MaintenanceStatus {
  const hoursSinceService = roundHours(hourmeter - lastServiceHours);
  return {
    hoursSinceService,
    hoursUntilMaintenance: roundHours(Math.max(0, intervalHours - hoursSinceService)),
    // inclusivo: "si un equipo lo alcanza"
    requiresMaintenance: hoursSinceService >= intervalHours,
  };
}
