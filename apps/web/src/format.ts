const hoursFormat = new Intl.NumberFormat('es-CL', {
  maximumFractionDigits: 1,
  // los locales en español omiten el separador en números de 4 dígitos por defecto; los horómetros se leen mejor con él
  useGrouping: 'always',
});

export function formatHours(value: number): string {
  return `${hoursFormat.format(value)} h`;
}

/** porción del intervalo usada en el ciclo actual, 0-100 */
export function cycleProgress({ hoursSinceService, intervalHours }: { hoursSinceService: number; intervalHours: number }) {
  if (intervalHours <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round((hoursSinceService / intervalHours) * 100)));
}

/**
 * Lee una entrada de horas; null cuando no es un número. Acepta lo que muestra formatHours
 * ("1.234,5": punto para miles, coma para decimales) y un punto decimal simple ("120.5").
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

/** valor para un <input type="datetime-local">: hora local, al minuto */
export function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** instante ISO a partir de un valor datetime-local (leído como hora local); null cuando está vacío o es inválido */
export function fromLocalInput(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const dateFormat = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' });

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}
