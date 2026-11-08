import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/**
 * Password hashing with scrypt (built into Node, memory-hard).
 * Stored format is self-describing: scrypt:N:r:p:salt:hash (salt and hash in base64url),
 * so the cost can be raised later without breaking existing hashes. The separator is ":" and
 * not "$" because dotenv expands "$NAME" inside .env values and would corrupt the hash.
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

/** true only for the right password; a malformed hash is a "no", never an exception */
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
