import { registerAs } from '@nestjs/config';

/**
 * M28.6 — Connected Mailbox (Gmail/Outlook OAuth sending) config.
 * `productionSendingEnabled` is the master kill switch — the same "fail closed by default"
 * pattern as every other real-external-side-effect flag in this codebase
 * (`EMAIL_PRODUCTION_SENDING_ENABLED` M28, `EMAIL_ATTACHMENTS_PRODUCTION_ENABLED` M28.5).
 *
 * Rate-limit defaults are deliberately conservative, not merely "whatever the provider technically
 * allows" (Phase 13's own explicit instruction) — a connected personal mailbox is not bulk-email
 * infrastructure. Every number here is a real, documented starting point, fully configurable, and
 * named as an explicit "review before scaling up" decision in the M28.6 report rather than
 * silently assumed correct forever.
 */
export default registerAs('connectedMailbox', () => ({
  productionSendingEnabled: (process.env.CONNECTED_MAILBOX_PRODUCTION_SENDING_ENABLED ?? 'false').toLowerCase() === 'true',

  // M29 — a domain we own purely as a Message-ID uniqueness namespace (RFC 5322 does not require
  // it to resolve via DNS); used only by the Gmail adapter, which builds its own raw MIME and so
  // must supply this header itself (Outlook/Graph generates its own `internetMessageId`).
  messageIdDomain: process.env.CONNECTED_MAILBOX_MESSAGE_ID_DOMAIN ?? 'mail.germanjobengine.internal',

  tokenEncryption: {
    // Base64-encoded 32-byte (256-bit) key for AES-256-GCM. Empty by default — the token vault
    // fails closed (refuses to encrypt/decrypt, so connecting a mailbox is impossible) until a
    // real key is configured, rather than ever silently storing a token in plaintext.
    key: process.env.MAILBOX_TOKEN_ENCRYPTION_KEY ?? '',
    keyVersion: parseInt(process.env.MAILBOX_TOKEN_ENCRYPTION_KEY_VERSION ?? '1', 10),
  },

  google: {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '',
    // A single, fixed, server-configured redirect URI — the simplest and safest form of
    // "allowlisting" (Phase 5): there is no dynamic list to misconfigure because only one value
    // is ever built or accepted. Must point at this API's own callback controller
    // (`MailboxConnectionsController.callback()`, which performs the token exchange and then
    // itself redirects the browser to the frontend) — never a frontend route directly, since the
    // frontend never receives or exchanges the authorization code.
    redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI ?? 'http://localhost:4000/mailbox-connections/callback/google',
  },

  microsoft: {
    clientId: process.env.MICROSOFT_OAUTH_CLIENT_ID ?? '',
    clientSecret: process.env.MICROSOFT_OAUTH_CLIENT_SECRET ?? '',
    redirectUri: process.env.MICROSOFT_OAUTH_REDIRECT_URI ?? 'http://localhost:4000/mailbox-connections/callback/microsoft',
    // 'common' accepts both personal Microsoft accounts and work/school accounts — the correct
    // default for a candidate-facing product where either is plausible; a real production Entra
    // app registration may narrow this per the operator's own tenancy decision.
    tenant: process.env.MICROSOFT_OAUTH_TENANT ?? 'common',
  },

  oauthTransaction: {
    expiryMinutes: parseInt(process.env.OAUTH_TRANSACTION_EXPIRY_MINUTES ?? '10', 10),
  },

  consent: {
    version: process.env.CONNECTED_MAILBOX_CONSENT_VERSION ?? '1.0',
  },

  rateLimits: {
    dailySendLimit: parseInt(process.env.CONNECTED_MAILBOX_DAILY_SEND_LIMIT ?? '30', 10),
    hourlySendLimit: parseInt(process.env.CONNECTED_MAILBOX_HOURLY_SEND_LIMIT ?? '10', 10),
    minSendIntervalMs: parseInt(process.env.CONNECTED_MAILBOX_MIN_SEND_INTERVAL_MS ?? '20000', 10),
    // A newly-connected mailbox is the highest deliverability/reputation risk (no sending
    // history) — a real warm-up window with a stricter daily cap is standard email-deliverability
    // practice, not an invented restriction.
    warmupDays: parseInt(process.env.CONNECTED_MAILBOX_WARMUP_DAYS ?? '7', 10),
    warmupDailySendLimit: parseInt(process.env.CONNECTED_MAILBOX_WARMUP_DAILY_LIMIT ?? '5', 10),
    // Once at least this many sends have been attempted in the trailing window, a failure rate
    // above this threshold auto-suspends the mailbox (Phase 13 "automatic pause").
    failureRateThreshold: parseFloat(process.env.CONNECTED_MAILBOX_FAILURE_RATE_THRESHOLD ?? '0.3'),
    failureRateMinSamples: parseInt(process.env.CONNECTED_MAILBOX_FAILURE_RATE_MIN_SAMPLES ?? '5', 10),
  },
}));
