import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireUser } from '../auth/guard.js';
import { verifyPassword } from '../auth/password.js';
import { LoginThrottle } from '../auth/throttle.js';
import { signToken } from '../auth/tokens.js';
import type { Config } from '../config.js';
import { tooManyRequests, unauthorized } from '../errors.js';
import { parse } from '../schemas.js';

const loginSchema = z.object({
  username: z.string({ error: 'Ingrese su usuario.' }).trim().toLowerCase().min(1, 'Ingrese su usuario.').max(100),
  password: z.string({ error: 'Ingrese su contraseña.' }).min(1, 'Ingrese su contraseña.').max(200),
});

// a valid hash to compare against when the user does not exist, so both cases take the same time
const DUMMY_HASH = 'scrypt:16384:8:1:AAAAAAAAAAAAAAAAAAAAAA:' + 'A'.repeat(86);

export const authRoutes: FastifyPluginAsync<{ auth: Config['auth'] }> = async (app, { auth }) => {
  const throttle = new LoginThrottle();

  app.post('/auth/login', async (request) => {
    const { username, password } = parse(loginSchema, request.body);

    const wait = throttle.hit(request.ip);
    if (wait > 0) {
      throw tooManyRequests(`Demasiados intentos fallidos. Intente de nuevo en ${Math.ceil(wait / 60)} min.`, wait);
    }

    const account = auth.accounts.find((a) => a.username === username);
    const valid = await verifyPassword(password, account?.passwordHash ?? DUMMY_HASH);
    if (!account || !valid) throw unauthorized('Usuario o contraseña incorrectos.');

    throttle.clear(request.ip);
    const user = { username: account.username, role: account.role };
    return { ...signToken(user, auth.tokenSecret), user };
  });

  app.get('/auth/me', async (request) => requireUser(request));
};
