import type { Session } from './auth/session';

// CARGADOR es temporal (prueba de deploy)
export type TypeCode = 'CAMION' | 'EXCAVADORA' | 'PERFORADORA' | 'CARGADOR';

/**
 * Un código de tipo tal como lo envía la API. El catálogo vive en la base de datos y puede ir por
 * delante de este build, así que es un string simple: nunca asumas que es uno de los valores de TypeCode de arriba.
 */
export type ApiTypeCode = string;

export interface EquipmentType {
  code: ApiTypeCode;
  name: string;
  maintenanceIntervalHours: number;
}

export interface Equipment {
  id: string;
  code: string;
  typeCode: ApiTypeCode;
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
  /** usuario que lo registró; null para registros anteriores al login */
  performedBy: string | null;
  createdAt: string;
}

export interface EquipmentInput {
  code: string;
  typeCode: ApiTypeCode;
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

/** error devuelto por la API, con su código estable y detalles por campo */
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

// conexión con la sesión, la define la app: de dónde sale el token y qué hacer cuando es rechazado
let currentToken: () => string | null = () => null;
let onUnauthorized: () => void = () => {};

export function configureAuth(options: { token: () => string | null; onUnauthorized: () => void }) {
  currentToken = options.token;
  onUnauthorized = options.onUnauthorized;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body) headers['Content-Type'] = 'application/json';
  const token = currentToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, 'NETWORK', 'No se pudo conectar con el servidor. Revise su conexión e intente de nuevo.');
  }
  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);
  // una sesión expirada o revocada en cualquier lugar salvo el formulario de login devuelve al usuario al login
  if (res.status === 401 && token) onUnauthorized();
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
  login: (username: string, password: string) => request<Session>('/api/auth/login', json('POST', { username, password })),
  types: () => request<EquipmentType[]>('/api/equipment-types'),
  list: () => request<Equipment[]>('/api/equipment'),
  create: (input: EquipmentInput) => request<Equipment>('/api/equipment', json('POST', input)),
  update: (id: string, input: Partial<EquipmentInput>) => request<Equipment>(`/api/equipment/${id}`, json('PATCH', input)),
  remove: (id: string) => request<void>(`/api/equipment/${id}`, { method: 'DELETE' }),
  history: (id: string) => request<Maintenance[]>(`/api/equipment/${id}/maintenances`),
  registerMaintenance: (id: string, input: MaintenanceInput) =>
    request<{ maintenance: Maintenance; equipment: Equipment }>(`/api/equipment/${id}/maintenances`, json('POST', input)),
};
