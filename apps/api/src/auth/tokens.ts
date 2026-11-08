import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Stateless session tokens: base64url(JSON payload) + "." + HMAC-SHA256 signature.
 * Frontend and backend live on different origins, so the token travels as a Bearer header
 * instead of a cookie. Rotating AUTH_TOKEN_SECRET signs every session out.
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

/** the session user, or null for a missing, forged, malformed or expired token */
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
