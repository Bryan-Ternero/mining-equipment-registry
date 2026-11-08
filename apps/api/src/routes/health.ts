import type { PrismaClient } from '@prisma/client';
import type { FastifyPluginAsync } from 'fastify';

/**
 * GET /health: 200 when the service and its database answer, 503 otherwise.
 * `version` is the deployed commit, so the deploy can prove which build is live.
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
