/**
 * Limitador de intentos de login por dirección del cliente, en memoria (una sola instancia de la API).
 * Un intento se cuenta antes de verificar la contraseña, así una ráfaga de peticiones en paralelo
 * no puede colar intentos adicionales. Un login exitoso libera la dirección.
 */
export class LoginThrottle {
  private readonly attempts = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly maxAttempts = 5,
    private readonly windowMs = 15 * 60_000,
  ) {}

  /** registra un intento; devuelve los segundos de espera si la dirección está bloqueada, si no 0 */
  hit(key: string, now = Date.now()): number {
    const entry = this.attempts.get(key);
    if (!entry || now >= entry.resetAt) {
      this.attempts.set(key, { count: 1, resetAt: now + this.windowMs });
      this.prune(now);
      return 0;
    }
    if (entry.count >= this.maxAttempts) return Math.ceil((entry.resetAt - now) / 1000);
    entry.count += 1;
    return 0;
  }

  clear(key: string) {
    this.attempts.delete(key);
  }

  /** mantiene acotado el mapa: descarta las entradas vencidas cuando crece */
  private prune(now: number) {
    if (this.attempts.size < 1000) return;
    for (const [key, entry] of this.attempts) if (now >= entry.resetAt) this.attempts.delete(key);
  }
}
