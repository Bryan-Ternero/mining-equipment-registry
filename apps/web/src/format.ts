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

const dateFormat = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' });

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}
