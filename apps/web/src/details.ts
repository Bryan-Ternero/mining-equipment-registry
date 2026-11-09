/**
 * Detalle de un equipo que se muestra al pasar el mouse (o al tocar el botón de información en el
 * celular). Es lógica pura: arma las filas a partir del equipo para poder probarla sin navegador.
 */
import type { Equipment } from './api';
import { formatDate, formatHours } from './format';

export interface DetailRow {
  label: string;
  value: string;
}

const dayFormat = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium' });

/** "hace 45 min", "hace 2 h", "hace 3 días": cuánto pasó desde una fecha */
export function formatRelative(iso: string, now = Date.now()): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'hace un momento';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} ${days === 1 ? 'día' : 'días'}`;
}

export function equipmentDetails(equipment: Equipment, now = Date.now()): DetailRow[] {
  const last = equipment.lastMaintenance;
  const rows: DetailRow[] = [{ label: 'Registrado', value: dayFormat.format(new Date(equipment.createdAt)) }];

  if (last) {
    rows.push({
      label: 'Último mantenimiento',
      value: last.performedBy ? `${formatDate(last.performedAt)} · por ${last.performedBy}` : formatDate(last.performedAt),
    });
    if (last.notes) rows.push({ label: 'Comentario', value: last.notes });
    rows.push({ label: 'Horómetro en ese servicio', value: formatHours(last.hourmeter) });
  } else {
    rows.push({ label: 'Último mantenimiento', value: 'Sin mantenimientos todavía' });
  }

  const count = equipment.maintenanceCount;
  rows.push({
    label: 'Mantenimientos',
    value: count === 0 ? 'Ninguno' : `${count} ${count === 1 ? 'registrado' : 'registrados'}`,
  });
  rows.push({ label: 'Última actualización', value: formatRelative(equipment.updatedAt, now) });
  return rows;
}
