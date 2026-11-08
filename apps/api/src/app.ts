import cors from '@fastify/cors';
import type { PrismaClient } from '@prisma/client';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Config } from './config.js';
import { AppError } from './errors.js';
import { equipmentRoutes } from './routes/equipment.js';
import { healthRoutes } from './routes/health.js';
import { EquipmentService } from './services/equipment-service.js';

export interface AppDeps {
  config: Config;
  db: PrismaClient;
  logger?: boolean;
}

export function buildApp({ config, db, logger = false }: AppDeps): FastifyInstance {
  const app = Fastify({ logger });

  app.register(cors, {
    origin: config.webOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });

  // one error shape for every failure: { error: { code, message, details? } }
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
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
  app.register(equipmentRoutes, { prefix: '/api', service: new EquipmentService(db) });

  return app;
}
