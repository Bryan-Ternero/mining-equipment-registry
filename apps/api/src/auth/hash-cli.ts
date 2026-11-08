/**
 * Prints the scrypt hash of a password for AUTH_*_PASSWORD_HASH, plus a fresh AUTH_TOKEN_SECRET.
 *
 *   AUTH_PASSWORD='the-password' npm --prefix apps/api run auth:hash
 *
 * The password comes from an environment variable, not an argument, so it does not end up in
 * the shell history or the process list.
 */
import { randomBytes } from 'node:crypto';
import { hashPassword } from './password.js';

const password = process.env.AUTH_PASSWORD;
if (!password) {
  console.error("Set AUTH_PASSWORD: AUTH_PASSWORD='the-password' npm --prefix apps/api run auth:hash");
  process.exit(1);
}
if (password.length < 8) {
  console.error('Use a password of at least 8 characters.');
  process.exit(1);
}

console.log(`PASSWORD_HASH=${await hashPassword(password)}`);
console.log(`AUTH_TOKEN_SECRET=${randomBytes(32).toString('base64url')}`);
