import { registerAs } from '@nestjs/config';

function optionalInt(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * M28 — Email Infrastructure config. `productionSendingEnabled` is the master kill switch,
 * mirroring `BILLING_PRODUCTION_PAYMENTS_ENABLED` (M27) and `EXECUTION_ACTIVATION_ENABLED`
 * (M26)'s identical "fail closed by default" pattern: real external email delivery requires this
 * flag AND at least one real provider adapter to actually have its required credentials
 * configured (see each adapter's own `isAvailable()`) — neither alone is sufficient. Defaults to
 * `false`, matching every other "activate a real external side effect" flag in this codebase.
 *
 * Per-provider daily limits deliberately default to `null` (unknown/unbounded from this
 * application's own perspective) rather than a guessed number — a provider's real daily quota is
 * account-specific (negotiated/tier-dependent) and this codebase's own discipline is to never
 * assert a number it cannot verify. Set the corresponding env var to the real, contracted limit
 * for your account if you want `ProviderCapabilities.dailyDeliveryLimit` to reflect it.
 */
export default registerAs('emailInfrastructure', () => ({
  productionSendingEnabled: (process.env.EMAIL_PRODUCTION_SENDING_ENABLED ?? 'false').toLowerCase() === 'true',
  /** Which real adapter `EMAIL_PROVIDER` (the simple single-provider facade
   * `EmailProviderGatewayService`/Billing notifications use) resolves to — `resend`|`ses`|
   * `sendgrid`|`smtp`|`null`. Defaults to `null` (the safe, always-available, never-sends
   * placeholder), matching every other "real external side effect" flag in this codebase
   * defaulting to off. */
  primaryProvider: (process.env.EMAIL_PRIMARY_PROVIDER ?? 'null').toLowerCase(),

  resend: {
    apiKey: process.env.RESEND_API_KEY ?? '',
    webhookSecret: process.env.RESEND_WEBHOOK_SECRET ?? '',
    dailyLimit: optionalInt(process.env.RESEND_DAILY_LIMIT),
  },
  ses: {
    region: process.env.AWS_SES_REGION ?? '',
    accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY ?? '',
    dailyLimit: optionalInt(process.env.AWS_SES_DAILY_LIMIT),
  },
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY ?? '',
    // SendGrid's Event Webhook is signed with an Elliptic Curve key pair (not a shared HMAC
    // secret) — this is the base64-encoded EC public key SendGrid's dashboard displays once
    // signing is enabled, used to *verify* inbound webhooks; it is not itself a secret.
    webhookVerificationKey: process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY ?? '',
    dailyLimit: optionalInt(process.env.SENDGRID_DAILY_LIMIT),
  },
  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: (process.env.SMTP_SECURE ?? 'false').toLowerCase() === 'true',
    user: process.env.SMTP_USER ?? '',
    password: process.env.SMTP_PASSWORD ?? '',
    dailyLimit: optionalInt(process.env.SMTP_DAILY_LIMIT),
  },

  queue: {
    enabled: (process.env.EMAIL_QUEUE_ENABLED ?? 'true').toLowerCase() !== 'false',
    tickIntervalMs: parseInt(process.env.EMAIL_QUEUE_TICK_INTERVAL_MS ?? '5000', 10),
    concurrency: parseInt(process.env.EMAIL_QUEUE_CONCURRENCY ?? '10', 10),
    defaultMaxAttempts: parseInt(process.env.EMAIL_QUEUE_MAX_ATTEMPTS ?? '5', 10),
    baseBackoffMs: parseInt(process.env.EMAIL_QUEUE_BASE_BACKOFF_MS ?? '30000', 10),
    maxBackoffMs: parseInt(process.env.EMAIL_QUEUE_MAX_BACKOFF_MS ?? '1800000', 10),
  },

  providerManager: {
    sendTimeoutMs: parseInt(process.env.EMAIL_SEND_TIMEOUT_MS ?? '10000', 10),
    circuitBreakerThreshold: parseInt(process.env.EMAIL_CIRCUIT_BREAKER_THRESHOLD ?? '5', 10),
    circuitBreakerCooldownMs: parseInt(process.env.EMAIL_CIRCUIT_BREAKER_COOLDOWN_MS ?? '300000', 10),
  },

  webhookToleranceSeconds: parseInt(process.env.EMAIL_WEBHOOK_TOLERANCE_SECONDS ?? '300', 10),
}));
