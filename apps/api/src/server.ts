/**
 * Punto de entrada del proceso: carga la configuración, empieza a escuchar y cierra limpiamente el
 * servidor y la conexión a la base de datos ante SIGTERM, que Railway envía en cada redeploy.
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
