/**
 * Process entry point: loads the configuration, starts listening and closes the server and the
 * database connection cleanly on SIGTERM, which Railway sends on every redeploy.
 */
import { PrismaClient } from '@prisma/client';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const db = new PrismaClient();
const app = buildApp({ config, db, logger: true });

async function shutdown(signal: string) {
  app.log.info(`${signal} received, closing`);
  await app.close();
  await db.$disconnect();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
} catch (error) {
  app.log.error(error);
  await db.$disconnect();
  process.exit(1);
}
