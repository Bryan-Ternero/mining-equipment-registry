export type TypeCode = 'CAMION' | 'EXCAVADORA' | 'PERFORADORA';

export interface EquipmentType {
  code: TypeCode;
  name: string;
  maintenanceIntervalHours: number;
}

export interface Equipment {
  id: string;
  code: string;
  typeCode: TypeCode;
  typeName: string;
  intervalHours: number;
  hourmeter: number;
  lastServiceHours: number;
  hoursSinceService: number;
  hoursUntilMaintenance: number;
  requiresMaintenance: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Maintenance {
  id: string;
  equipmentId: string;
  hourmeter: number;
  performedAt: string;
  notes: string | null;
  createdAt: string;
}

export interface EquipmentInput {
  code: string;
  typeCode: TypeCode;
  hourmeter: number;
}

export interface MaintenanceInput {
  hourmeter?: number;
  performedAt?: string;
  notes?: string;
}

export interface FieldError {
  field: string | null;
  message: string;
}

/** error returned by the API, with its stable code and per-field details */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: FieldError[] = [],
  ) {
    super(message);
  }
}

const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'No se pudo conectar con el servidor. Revise su conexión e intente de nuevo.');
  }
  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const error = body?.error;
    throw new ApiError(
      res.status,
      error?.code ?? 'UNKNOWN',
      error?.message ?? `Error inesperado del servidor (${res.status}).`,
      Array.isArray(error?.details) ? error.details : [],
    );
  }
  return body as T;
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export const api = {
  types: () => request<EquipmentType[]>('/api/equipment-types'),
  list: () => request<Equipment[]>('/api/equipment'),
  create: (input: EquipmentInput) => request<Equipment>('/api/equipment', json('POST', input)),
  update: (id: string, input: Partial<EquipmentInput>) => request<Equipment>(`/api/equipment/${id}`, json('PATCH', input)),
  remove: (id: string) => request<void>(`/api/equipment/${id}`, { method: 'DELETE' }),
  history: (id: string) => request<Maintenance[]>(`/api/equipment/${id}/maintenances`),
  registerMaintenance: (id: string, input: MaintenanceInput) =>
    request<{ maintenance: Maintenance; equipment: Equipment }>(`/api/equipment/${id}/maintenances`, json('POST', input)),
};
