/**
 * Builds the Fastify application: CORS, the session guard, one error shape for every failure and the
 * route plugins. server.ts makes it listen; the tests build it with an injected config and database.
 */
import cors from '@fastify/cors';
import type { PrismaClient } from '@prisma/client';
import Fastify, { type FastifyInstance } from 'fastify';
import { sessionFrom } from './auth/guard.js';
import type { Config } from './config.js';
import { AppError, unauthorized } from './errors.js';
import { authRoutes } from './routes/auth.js';
import { equipmentRoutes } from './routes/equipment.js';
import { healthRoutes } from './routes/health.js';
import { EquipmentService } from './services/equipment-service.js';

export interface AppDeps {
  config: Config;
  db: PrismaClient;
  logger?: boolean;
}

/** routes reachable without a session; everything else under /api needs one */
const PUBLIC_API_ROUTES = new Set(['POST /api/auth/login']);

export function buildApp({ config, db, logger = false }: AppDeps): FastifyInstance {
  // behind Railway's proxy: trust exactly that one hop, so request.ip is the address the proxy
  // appended to X-Forwarded-For. Trusting every hop would let a client forge its own address and
  // dodge the login throttle.
  const app = Fastify({ logger, trustProxy: (_address: string, hop: number) => hop < 1 });

  app.register(cors, {
    origin: config.webOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.decorateRequest('user', null);
  app.addHook('onRequest', async (request) => {
    request.user = sessionFrom(request, config.auth.tokenSecret);
  });
  // decided on the route the router matched, never on the raw URL: the router decodes the path,
  // so "/%61pi/equipment" reaches "/api/equipment" while failing a raw "/api/" prefix check
  app.addHook('preHandler', async (request) => {
    const route = request.routeOptions.url;
    if (request.method === 'OPTIONS' || !route?.startsWith('/api/')) return;
    if (!request.user && !PUBLIC_API_ROUTES.has(`${request.method} ${route}`)) throw unauthorized();
  });

  // one error shape for every failure: { error: { code, message, details? } }
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      const retry = (error.details as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds;
      if (error.status === 429 && retry) reply.header('Retry-After', String(retry));
      return reply.status(error.status).send({
        error: { code: error.code, message: error.message, details: error.details },
      });
    }
    const status = (error as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500) {
      // malformed JSON, payload too large, wrong content type...
      return reply.status(status).send({ error: { code: 'BAD_REQUEST', message: (error as Error).message } });
    }
    request.log.error(error);
    return reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor.' } });
  });

  app.setNotFoundHandler((request, reply) =>
    reply.status(404).send({ error: { code: 'NOT_FOUND', message: `Ruta no encontrada: ${request.method} ${request.url}` } }),
  );

  app.register(healthRoutes, { db, version: config.version });
  app.register(authRoutes, { prefix: '/api', auth: config.auth });
  app.register(equipmentRoutes, { prefix: '/api', service: new EquipmentService(db) });

  return app;
}
