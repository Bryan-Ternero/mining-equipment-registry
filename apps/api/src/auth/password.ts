import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/**
 * Hash de contraseñas con scrypt (incluido en Node, de alto consumo de memoria).
 * El formato guardado se describe a sí mismo: scrypt:N:r:p:salt:hash (salt y hash en base64url),
 * así el costo se puede aumentar más adelante sin romper los hashes existentes. El separador es ":"
 * y no "$" porque dotenv expande "$NAME" dentro de los valores de .env y corrompería el hash.
 */

const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;

function derive(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, KEY_LENGTH, options, (error, key) => (error ? reject(error) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, { N, r: R, p: P });
  return ['scrypt', N, R, P, salt.toString('base64url'), key.toString('base64url')].join(':');
}

/** true solo para la contraseña correcta; un hash mal formado es un "no", nunca una excepción */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, salt, hash] = parts;
  const expected = Buffer.from(hash ?? '', 'base64url');
  if (expected.length !== KEY_LENGTH) return false;
  try {
    const key = await derive(password, Buffer.from(salt ?? '', 'base64url'), {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}
