/**
 * Configuración de ejecución a partir de variables de entorno. Falla al arrancar listando todas
 * las variables faltantes, así un deploy mal configurado nunca empieza a atender peticiones.
 */
import type { Role } from './auth/tokens.js';

export interface Account {
  username: string;
  role: Role;
  /** hash scrypt generado con `npm run auth:hash`, nunca la contraseña */
  passwordHash: string;
}

export interface Config {
  port: number;
  webOrigins: string[];
  version: string;
  auth: {
    tokenSecret: string;
    accounts: Account[];
  };
}

/** lee la configuración de ejecución; DATABASE_URL la lee el propio Prisma */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const missing: string[] = [];
  const required = (name: string) => {
    const value = env[name]?.trim();
    if (!value) missing.push(name);
    return value ?? '';
  };

  required('DATABASE_URL');
  const tokenSecret = required('AUTH_TOKEN_SECRET');
  const accounts: Account[] = [
    {
      username: required('AUTH_SUPERVISOR_USERNAME').toLowerCase(),
      role: 'SUPERVISOR',
      passwordHash: required('AUTH_SUPERVISOR_PASSWORD_HASH'),
    },
    {
      username: required('AUTH_OPERATOR_USERNAME').toLowerCase(),
      role: 'OPERADOR',
      passwordHash: required('AUTH_OPERATOR_PASSWORD_HASH'),
    },
  ];

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}. See .env.example and 'npm run auth:hash'.`);
  }
  if (tokenSecret.length < 32) throw new Error('AUTH_TOKEN_SECRET must be at least 32 characters long.');
  if (accounts[0]?.username === accounts[1]?.username) {
    throw new Error('AUTH_SUPERVISOR_USERNAME and AUTH_OPERATOR_USERNAME must be different.');
  }
  for (const account of accounts) {
    if (!account.passwordHash.startsWith('scrypt:')) {
      throw new Error(`The password hash of '${account.username}' is not a scrypt hash: generate it with 'npm run auth:hash'.`);
    }
  }

  return {
    port: Number(env.PORT ?? 3001),
    // lista separada por comas, así se pueden permitir a la vez un frontend local y uno desplegado
    webOrigins: (env.WEB_ORIGIN ?? 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim().replace(/\/$/, ''))
      .filter(Boolean),
    // deploy.sh la fija en el commit desplegado, así /health demuestra qué build está en producción
    version: env.APP_VERSION ?? 'dev',
    auth: { tokenSecret, accounts },
  };
}
