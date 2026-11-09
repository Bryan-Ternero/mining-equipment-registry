  /**
 * Validación de peticiones con zod. Los mensajes están en español porque el frontend los muestra tal
 * como llegan, y todos los campos inválidos se informan a la vez (400 con una entrada por campo).
 */
import { z } from 'zod';
import { invalid } from './errors.js';

const MAX_HOURS = 999_999;

const hours = z
  .number({ error: 'Debe ser un número.' })
  .finite()
  .min(0, 'No puede ser negativo.')
  .max(MAX_HOURS, `No puede superar ${MAX_HOURS} h.`)
  .refine((value) => Math.abs(value * 10 - Math.round(value * 10)) < 1e-6, {
    message: 'Admite como máximo un decimal.',
  });

const code = z
  .string({ error: 'Debe ser texto.' })
  .trim()
  .toUpperCase()
  .min(1, { error: 'Es obligatorio.', abort: true })
  .max(30, 'Máximo 30 caracteres.')
  .regex(/^[A-Z0-9][A-Z0-9-]*$/, 'Solo letras, números y guiones (ej. CAM-001).');

// CARGADOR es temporal (prueba de deploy, ver la migración 20261108160000_add_loader_type)
const typeCode = z.enum(['CAMION', 'EXCAVADORA', 'PERFORADORA', 'CARGADOR', 'DRAGA'], {
  error: 'Tipo inválido: CAMION, EXCAVADORA, PERFORADORA , CARGADOR o DRAGA.',
});

export const createEquipmentSchema = z.object({
  code,
  typeCode,
  hourmeter: hours,
});

export const updateEquipmentSchema = createEquipmentSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: 'Envíe al menos un campo para editar.' });

export const createMaintenanceSchema = z.object({
  /** lectura al momento del mantenimiento; por defecto, el horómetro actual */
  hourmeter: hours.optional(),
  performedAt: z.iso
    .datetime({ offset: true, error: 'Fecha inválida (ISO 8601).' })
    .refine((value) => new Date(value).getTime() <= Date.now() + 60_000, {
      message: 'La fecha no puede ser futura.',
    })
    .optional(),
  notes: z.string().trim().max(500, 'Máximo 500 caracteres.').optional(),
});

export const idParamSchema = z.object({ id: z.uuid({ error: 'Identificador inválido.' }) });

export type CreateEquipmentInput = z.infer<typeof createEquipmentSchema>;
export type UpdateEquipmentInput = z.infer<typeof updateEquipmentSchema>;
export type CreateMaintenanceInput = z.infer<typeof createMaintenanceSchema>;

/** valida, o lanza un 400 que lista todos los problemas de los campos */
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value ?? {});
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.') || null,
      message: issue.message,
    }));
    throw invalid(details.map((d) => (d.field ? `${d.field}: ${d.message}` : d.message)).join(' '), details);
  }
  return result.data;
}
