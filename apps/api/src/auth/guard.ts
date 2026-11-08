import type { FastifyRequest } from 'fastify';
import { forbidden, unauthorized } from '../errors.js';
import { verifyToken, type Role, type SessionUser } from './tokens.js';

declare module 'fastify' {
  interface FastifyRequest {
    user: SessionUser | null;
  }
}

/** reads the Bearer token; null when absent or invalid */
export function sessionFrom(request: FastifyRequest, secret: string): SessionUser | null {
  const header = request.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return verifyToken(token, secret);
}

export function requireUser(request: FastifyRequest): SessionUser {
  if (!request.user) throw unauthorized();
  return request.user;
}

export function requireRole(request: FastifyRequest, role: Role, action: string): SessionUser {
  const user = requireUser(request);
  if (user.role !== role) throw forbidden(`Solo un supervisor puede ${action}.`);
  return user;
}
