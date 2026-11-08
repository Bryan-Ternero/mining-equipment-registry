import type { Role } from './permissions';

export interface SessionUser {
  username: string;
  role: Role;
}

export interface Session {
  token: string;
  expiresAt: string;
  user: SessionUser;
}

const KEY = 'equipment-registry.session';

/** una sesión guardada, o null cuando falta, está mal formada, fue manipulada o expiró */
export function parseSession(raw: string | null, now = Date.now()): Session | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    const valid =
      typeof data?.token === 'string' &&
      typeof data?.expiresAt === 'string' &&
      typeof data?.user?.username === 'string' &&
      (data.user.role === 'SUPERVISOR' || data.user.role === 'OPERADOR');
    // una fecha no interpretable es NaN, y "NaN <= now" es false: se comprueba explícitamente
    const expires = new Date(data.expiresAt).getTime();
    if (!valid || !Number.isFinite(expires) || expires <= now) return null;
    return { token: data.token, expiresAt: data.expiresAt, user: { username: data.user.username, role: data.user.role } };
  } catch {
    return null;
  }
}

// el almacenamiento puede no estar disponible (modo privado, datos del sitio bloqueados): la app entonces
// solo pide iniciar sesión de nuevo
export function loadSession(): Session | null {
  try {
    return parseSession(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function saveSession(session: Session) {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* la sesión sigue viva en memoria para esta pestaña */
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nada guardado */
  }
}
