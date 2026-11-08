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

/** a stored session, or null when it is missing, malformed, tampered with or expired */
export function parseSession(raw: string | null, now = Date.now()): Session | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    const valid =
      typeof data?.token === 'string' &&
      typeof data?.expiresAt === 'string' &&
      typeof data?.user?.username === 'string' &&
      (data.user.role === 'SUPERVISOR' || data.user.role === 'OPERADOR');
    if (!valid || new Date(data.expiresAt).getTime() <= now) return null;
    return { token: data.token, expiresAt: data.expiresAt, user: { username: data.user.username, role: data.user.role } };
  } catch {
    return null;
  }
}

// storage can be unavailable (private mode, blocked site data): the app then just asks to log in again
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
    /* the session still lives in memory for this tab */
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing stored */
  }
}
