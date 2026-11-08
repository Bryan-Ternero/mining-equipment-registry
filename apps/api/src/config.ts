export interface Config {
  port: number;
  webOrigins: string[];
  version: string;
}

/** reads the runtime configuration; DATABASE_URL is read by Prisma itself */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
  }
  return {
    port: Number(env.PORT ?? 3001),
    // comma-separated list, so a local and a deployed frontend can both be allowed
    webOrigins: (env.WEB_ORIGIN ?? 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim().replace(/\/$/, ''))
      .filter(Boolean),
    // set by deploy.sh to the deployed commit, so /health proves which build is live
    version: env.APP_VERSION ?? 'dev',
  };
}
