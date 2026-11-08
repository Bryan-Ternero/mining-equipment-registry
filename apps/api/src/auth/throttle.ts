/**
 * Login attempt limiter per client address, in memory (one API instance).
 * An attempt is counted before the password is checked, so a burst of parallel requests
 * cannot slip extra guesses in. A successful login clears the address.
 */
export class LoginThrottle {
  private readonly attempts = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly maxAttempts = 5,
    private readonly windowMs = 15 * 60_000,
  ) {}

  /** registers one attempt; returns the seconds to wait when the address is blocked, else 0 */
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

  /** keeps the map bounded: drop expired entries once it grows */
  private prune(now: number) {
    if (this.attempts.size < 1000) return;
    for (const [key, entry] of this.attempts) if (now >= entry.resetAt) this.attempts.delete(key);
  }
}
