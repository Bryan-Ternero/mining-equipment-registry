/**
 * Construye la aplicación Fastify: CORS, el guard de sesión, una única forma de error para todos los
 * fallos y los plugins de rutas. server.ts la pone a escuchar; los tests la construyen con una
 * configuración y una base de datos inyectadas.
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

/** rutas accesibles sin sesión; todo lo demás bajo /api la requiere */
const PUBLIC_API_ROUTES = new Set(['POST /api/auth/login']);

export function buildApp({ config, db, logger = false }: AppDeps): FastifyInstance {
  // detrás del proxy de Railway: se confía exactamente en ese único salto, así request.ip es la
  // dirección que el proxy agregó a X-Forwarded-For. Confiar en todos los saltos permitiría que un
  // cliente falsificara su propia dirección y esquivara el límite de intentos de login.
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
  // se decide según la ruta que encontró el router, nunca según la URL cruda: el router decodifica
  // la ruta, así que "/%61pi/equipment" llega a "/api/equipment" aunque no pase una verificación
  // del prefijo "/api/" sobre la URL cruda
  app.addHook('preHandler', async (request) => {
    const route = request.routeOptions.url;
    if (request.method === 'OPTIONS' || !route?.startsWith('/api/')) return;
    if (!request.user && !PUBLIC_API_ROUTES.has(`${request.method} ${route}`)) throw unauthorized();
  });

  // una única forma de error para todos los fallos: { error: { code, message, details? } }
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
      // JSON mal formado, payload demasiado grande, content type incorrecto...
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
