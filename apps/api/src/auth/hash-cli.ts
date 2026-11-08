/**
 * Imprime el hash scrypt de una contraseña para AUTH_*_PASSWORD_HASH, más un AUTH_TOKEN_SECRET nuevo.
 *
 *   AUTH_PASSWORD='the-password' npm --prefix apps/api run auth:hash
 *
 * La contraseña llega por una variable de entorno, no por un argumento, así no queda en el
 * historial de la shell ni en la lista de procesos.
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
