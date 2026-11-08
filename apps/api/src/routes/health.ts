import type { PrismaClient } from '@prisma/client';
import type { FastifyPluginAsync } from 'fastify';

/**
 * GET /health: 200 cuando el servicio y su base de datos responden, 503 en caso contrario.
 * `version` es el commit desplegado, así el deploy puede demostrar qué build está en producción.
 */
export const healthRoutes: FastifyPluginAsync<{ db: PrismaClient; version: string }> = async (app, { db, version }) => {
  app.get('/health', async (_request, reply) => {
    let dbUp = true;
    try {
      await db.$queryRaw`SELECT 1`;
    } catch {
      dbUp = false;
    }
    return reply.status(dbUp ? 200 : 503).send({
      status: dbUp ? 'ok' : 'degraded',
      db: dbUp ? 'up' : 'down',
      version,
      time: new Date().toISOString(),
    });
  });
};
