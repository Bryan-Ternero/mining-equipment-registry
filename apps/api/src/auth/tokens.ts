import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Tokens de sesión sin estado: base64url(payload JSON) + "." + firma HMAC-SHA256.
 * El frontend y el backend están en orígenes distintos, así que el token viaja en un header
 * Bearer en lugar de una cookie. Rotar AUTH_TOKEN_SECRET cierra todas las sesiones.
 */

export const ROLES = ['SUPERVISOR', 'OPERADOR'] as const;
export type Role = (typeof ROLES)[number];

export interface SessionUser {
  username: string;
  role: Role;
}

const SESSION_HOURS = 12;

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function signToken(user: SessionUser, secret: string, now = Date.now()) {
  const exp = now + SESSION_HOURS * 3600_000;
  const payload = Buffer.from(JSON.stringify({ username: user.username, role: user.role, exp })).toString('base64url');
  return { token: `${payload}.${sign(payload, secret)}`, expiresAt: new Date(exp).toISOString() };
}

/** el usuario de la sesión, o null si el token falta, es falso, está mal formado o venció */
export function verifyToken(token: string, secret: string, now = Date.now()): SessionUser | null {
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) return null;

  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof data.username !== 'string' || !ROLES.includes(data.role) || typeof data.exp !== 'number') return null;
    if (now > data.exp) return null;
    return { username: data.username, role: data.role };
  } catch {
    return null;
  }
}
