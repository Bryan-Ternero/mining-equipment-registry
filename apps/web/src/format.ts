const hoursFormat = new Intl.NumberFormat('es-CL', {
  maximumFractionDigits: 1,
  // Spanish locales skip the separator on 4-digit numbers by default; hourmeters read better with it
  useGrouping: 'always',
});

export function formatHours(value: number): string {
  return `${hoursFormat.format(value)} h`;
}

/** share of the interval used in the current cycle, 0-100 */
export function cycleProgress({ hoursSinceService, intervalHours }: { hoursSinceService: number; intervalHours: number }) {
  if (intervalHours <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round((hoursSinceService / intervalHours) * 100)));
}

/**
 * Reads an hours input; null when it is not a number. Accepts what formatHours displays
 * ("1.234,5": point for thousands, comma for decimals) and a plain decimal point ("120.5").
 */
export function parseHours(raw: string): number | null {
  let text = raw.trim();
  if (text.includes(',')) {
    text = text.replaceAll('.', '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
    text = text.replaceAll('.', '');
  }
  if (text === '') return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/** value for an <input type="datetime-local">: local time, to the minute */
export function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** ISO instant from a datetime-local value (read as local time); null when empty or invalid */
export function fromLocalInput(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const dateFormat = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' });

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}
