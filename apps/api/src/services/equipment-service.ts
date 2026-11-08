import { Prisma, type PrismaClient } from '@prisma/client';
import { maintenanceStatus } from '../domain/maintenance.js';
import { AppError, conflict, invalid, notFound } from '../errors.js';
import type { CreateEquipmentInput, CreateMaintenanceInput, UpdateEquipmentInput } from '../schemas.js';

const withType = { type: true } as const;
type EquipmentRow = Prisma.EquipmentGetPayload<{ include: typeof withType }>;
type MaintenanceRow = Prisma.MaintenanceRecordGetPayload<object>;

/** API shape of an equipment: stored fields plus the derived maintenance status */
export function toEquipmentDto(row: EquipmentRow) {
  const hourmeter = row.hourmeter.toNumber();
  const lastServiceHours = row.lastServiceHours.toNumber();
  const intervalHours = row.type.maintenanceIntervalHours;
  return {
    id: row.id,
    code: row.code,
    typeCode: row.typeCode,
    typeName: row.type.name,
    intervalHours,
    hourmeter,
    lastServiceHours,
    ...maintenanceStatus({ hourmeter, lastServiceHours, intervalHours }),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toMaintenanceDto(row: MaintenanceRow) {
  return {
    id: row.id,
    equipmentId: row.equipmentId,
    hourmeter: row.hourmeter.toNumber(),
    performedAt: row.performedAt.toISOString(),
    notes: row.notes,
    performedBy: row.performedBy,
    createdAt: row.createdAt.toISOString(),
  };
}

export type EquipmentDto = ReturnType<typeof toEquipmentDto>;

/** translates database errors that are part of the contract into API errors */
function mapDbError(error: unknown, code?: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') throw conflict(`Ya existe un equipo con el código ${code}.`);
    if (error.code === 'P2025') throw notFound('No existe el equipo solicitado.');
  }
  // a CHECK violation here means the row changed between the read and the write
  if (error instanceof Error && error.message.includes('equipment_cycle_not_negative')) {
    throw conflict('El equipo cambió mientras se editaba. Recargue e intente de nuevo.');
  }
  throw error;
}

/**
 * Row lock for read-validate-write sequences: two concurrent services or edits of the same
 * equipment run one after the other, so the second one validates against the first one's result.
 */
async function lockEquipment(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT 1 FROM "equipment" WHERE "id" = ${id}::uuid FOR UPDATE`;
}

export class EquipmentService {
  constructor(private readonly db: PrismaClient) {}

  listTypes() {
    return this.db.equipmentType.findMany({ orderBy: { code: 'asc' } });
  }

  async list(): Promise<EquipmentDto[]> {
    const rows = await this.db.equipment.findMany({ include: withType, orderBy: { code: 'asc' } });
    return rows.map(toEquipmentDto);
  }

  async get(id: string): Promise<EquipmentDto> {
    const row = await this.db.equipment.findUnique({ where: { id }, include: withType });
    if (!row) throw notFound('No existe el equipo solicitado.');
    return toEquipmentDto(row);
  }

  async create(input: CreateEquipmentInput): Promise<EquipmentDto> {
    try {
      const row = await this.db.equipment.create({
        data: { code: input.code, typeCode: input.typeCode, hourmeter: input.hourmeter },
        include: withType,
      });
      return toEquipmentDto(row);
    } catch (error) {
      mapDbError(error, input.code);
    }
  }

  async update(id: string, input: UpdateEquipmentInput): Promise<EquipmentDto> {
    try {
      return await this.db.$transaction(async (tx) => {
        await lockEquipment(tx, id);
        const current = await tx.equipment.findUnique({ where: { id } });
        if (!current) throw notFound('No existe el equipo solicitado.');

        const lastService = current.lastServiceHours.toNumber();
        if (input.hourmeter !== undefined && input.hourmeter < lastService) {
          throw invalid(
            `hourmeter: no puede ser menor a la lectura del último mantenimiento (${lastService} h).`,
            [{ field: 'hourmeter', message: `Mínimo ${lastService} h (último mantenimiento).` }],
          );
        }

        const row = await tx.equipment.update({
          where: { id },
          data: { code: input.code, typeCode: input.typeCode, hourmeter: input.hourmeter },
          include: withType,
        });
        return toEquipmentDto(row);
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      mapDbError(error, input.code);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.db.equipment.delete({ where: { id } });
    } catch (error) {
      mapDbError(error);
    }
  }

  async listMaintenances(id: string) {
    await this.get(id);
    const rows = await this.db.maintenanceRecord.findMany({
      where: { equipmentId: id },
      orderBy: [{ performedAt: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map(toMaintenanceDto);
  }

  /** records a service and restarts the cycle: the reading becomes the start of the next one */
  async registerMaintenance(id: string, input: CreateMaintenanceInput, performedBy: string) {
    try {
      return await this.db.$transaction(async (tx) => {
        await lockEquipment(tx, id);
        const current = await tx.equipment.findUnique({ where: { id } });
        if (!current) throw notFound('No existe el equipo solicitado.');

        const performedAt = input.performedAt ? new Date(input.performedAt) : new Date();
        const last = await tx.maintenanceRecord.findFirst({
          where: { equipmentId: id },
          orderBy: { performedAt: 'desc' },
        });
        if (last && performedAt < last.performedAt) {
          throw invalid(
            `performedAt: no puede ser anterior al último mantenimiento (${last.performedAt.toISOString()}).`,
            [{ field: 'performedAt', message: 'Anterior al último mantenimiento registrado.' }],
          );
        }

        const currentHours = current.hourmeter.toNumber();
        const reading = input.hourmeter ?? currentHours;
        if (reading < currentHours) {
          throw invalid(
            `hourmeter: la lectura del mantenimiento (${reading} h) no puede ser menor al horómetro actual (${currentHours} h).`,
            [{ field: 'hourmeter', message: `Mínimo ${currentHours} h (horómetro actual).` }],
          );
        }

        const record = await tx.maintenanceRecord.create({
          data: {
            equipmentId: id,
            hourmeter: reading,
            performedAt,
            notes: input.notes || null,
            performedBy,
          },
        });
        const equipment = await tx.equipment.update({
          where: { id },
          data: { hourmeter: reading, lastServiceHours: reading },
          include: withType,
        });
        return { maintenance: toMaintenanceDto(record), equipment: toEquipmentDto(equipment) };
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      mapDbError(error);
    }
  }
}
