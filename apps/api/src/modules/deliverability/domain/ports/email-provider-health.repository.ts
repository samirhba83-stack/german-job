export const EMAIL_PROVIDER_HEALTH_REPOSITORY = Symbol('EMAIL_PROVIDER_HEALTH_REPOSITORY');

export interface EmailProviderHealthSnapshot {
  readonly providerId: string;
  readonly consecutiveFailures: number;
  readonly lastFailureAt: Date | null;
  readonly lastSuccessAt: Date | null;
  readonly circuitOpenUntil: Date | null;
}

/**
 * Real, persisted per-provider health state — survives a restart and is shared across every API
 * instance, so the circuit breaker means the same thing everywhere, not just in one process's
 * memory. Backs both the Provider Manager's own failover decisions and the Admin Operations
 * "provider status" view (M28).
 */
export interface EmailProviderHealthRepository {
  get(providerId: string): Promise<EmailProviderHealthSnapshot | null>;
  getAll(): Promise<ReadonlyArray<EmailProviderHealthSnapshot>>;
  /** Resets `consecutiveFailures` to 0, stamps `lastSuccessAt`, and clears any open circuit. */
  recordSuccess(providerId: string, now: Date): Promise<void>;
  /** Increments `consecutiveFailures`, stamps `lastFailureAt`, and — once the threshold is
   * reached — opens the circuit until `now + cooldownMs`. */
  recordFailure(providerId: string, now: Date, threshold: number, cooldownMs: number): Promise<void>;
  /** Admin-triggered manual override (M28 Admin Operations "provider switching" — forcing a
   * provider off without waiting for real failures to trip the breaker). */
  forceOpen(providerId: string, now: Date, cooldownMs: number): Promise<void>;
  forceClose(providerId: string): Promise<void>;
}
