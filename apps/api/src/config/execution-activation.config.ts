import { registerAs } from '@nestjs/config';

export type EmailDeliveryMode = 'SAFE' | 'SANDBOX' | 'PRODUCTION';

function resolveDeliveryMode(): EmailDeliveryMode {
  const raw = (process.env.EMAIL_DELIVERY_MODE ?? 'SAFE').toUpperCase();
  if (raw === 'SAFE' || raw === 'SANDBOX' || raw === 'PRODUCTION') {
    return raw;
  }
  return 'SAFE';
}

/**
 * M26 — Execution Activation config. `deliveryMode` gates whether anything is even allowed to
 * attempt a real send; it defaults to SAFE (the NullEmailProvider path) unless EMAIL_DELIVERY_MODE
 * is explicitly set. PRODUCTION mode is a necessary but not sufficient condition for real email —
 * no real SMTP/SendGrid adapter is registered anywhere in this codebase (see email-provider
 * module), so setting PRODUCTION today still resolves to no provider being available. Activating
 * real external delivery requires both this flag AND a real provider adapter to be added and
 * bound — a decision this milestone deliberately does not make (see engineering report).
 */
export default registerAs('executionActivation', () => ({
  enabled: (process.env.EXECUTION_ACTIVATION_ENABLED ?? 'true').toLowerCase() !== 'false',
  tickIntervalMs: parseInt(process.env.EXECUTION_ACTIVATION_TICK_INTERVAL_MS ?? '30000', 10),
  lockTtlMs: parseInt(process.env.EXECUTION_ACTIVATION_LOCK_TTL_MS ?? '60000', 10),
  deliveryMode: resolveDeliveryMode(),
  maxTaskRetryAttempts: parseInt(process.env.EXECUTION_ACTIVATION_MAX_RETRY_ATTEMPTS ?? '3', 10),
}));
