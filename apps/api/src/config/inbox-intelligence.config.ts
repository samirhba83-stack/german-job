import { registerAs } from '@nestjs/config';

/**
 * M29 — Inbox Intelligence config. Every flag below defaults to the safe/disabled state,
 * matching every prior "real external side-effect" flag in this codebase
 * (`EMAIL_PRODUCTION_SENDING_ENABLED` M28, `EMAIL_ATTACHMENTS_PRODUCTION_ENABLED` M28.5,
 * `CONNECTED_MAILBOX_PRODUCTION_SENDING_ENABLED` M28.6).
 *
 * `automaticReplyEnabled` is deliberately NOT wired to any real send code path anywhere in this
 * module (`ReplyDraftService.approveAndSend()` always requires an explicit prior user approval,
 * unconditionally) — this flag exists only to satisfy the brief's own explicit "create this flag,
 * keep it false" instruction and to make the intent auditable in config, not because any code
 * branches on it to decide whether to skip user approval.
 */
export default registerAs('inboxIntelligence', () => ({
  connectedInboxProcessingEnabled: (process.env.CONNECTED_INBOX_PROCESSING_ENABLED ?? 'false').toLowerCase() === 'true',
  aiClassificationEnabled: (process.env.INBOX_AI_CLASSIFICATION_ENABLED ?? 'false').toLowerCase() === 'true',
  replyDraftingEnabled: (process.env.INBOX_REPLY_DRAFTING_ENABLED ?? 'false').toLowerCase() === 'true',
  // Non-Negotiable Principle #9 / the brief's own explicit instruction: must remain false during
  // this milestone. No code path in this module reads this flag to decide whether to send
  // automatically — see this file's own doc comment.
  automaticReplyEnabled: (process.env.INBOX_AUTOMATIC_REPLY_ENABLED ?? 'false').toLowerCase() === 'true',

  consent: {
    version: process.env.INBOX_CONSENT_VERSION ?? '1.0',
  },

  // M29 Phase 20 — this milestone's own confirmed retention decision: sanitized excerpts and
  // structured facts only (never full raw bodies), retained for this many days before the
  // excerpt itself is pruned (provider ids / classification / audit history are kept for the
  // full retention window regardless — see the retention service's own doc comment).
  retention: {
    excerptRetentionDays: parseInt(process.env.INBOX_EXCERPT_RETENTION_DAYS ?? '90', 10),
  },

  maxMessageSizeBytes: parseInt(process.env.INBOX_MAX_MESSAGE_SIZE_BYTES ?? String(5 * 1024 * 1024), 10),

  watch: {
    // How far ahead of real expiry the renewal job considers a watch "needs renewal" — Gmail
    // watches last ~7 days, Graph mail subscriptions ~3 days; a 24h margin comfortably covers
    // both without risking a real gap if a renewal attempt itself fails once.
    renewalHorizonHours: parseInt(process.env.INBOX_WATCH_RENEWAL_HORIZON_HOURS ?? '24', 10),
    renewalTickIntervalMs: parseInt(process.env.INBOX_WATCH_RENEWAL_TICK_INTERVAL_MS ?? String(60 * 60 * 1000), 10),
  },

  polling: {
    // The real "safe deterministic polling" mechanism Phase 5 asks for — doubles as the local-dev
    // fallback (no public webhook endpoint needed) AND the recovery mechanism after a missed
    // push notification, since it calls the exact same `fetchChangedMessages()` a webhook
    // notification would have triggered.
    enabled: (process.env.INBOX_POLLING_ENABLED ?? 'true').toLowerCase() === 'true',
    tickIntervalMs: parseInt(process.env.INBOX_POLLING_TICK_INTERVAL_MS ?? String(2 * 60 * 1000), 10),
  },

  google: {
    // A real Google Cloud Pub/Sub topic (e.g. projects/PROJECT/topics/TOPIC) Gmail's watch() call
    // publishes change notifications to; this application's own webhook endpoint is the topic's
    // push subscription target.
    pubSubTopicName: process.env.GOOGLE_INBOX_PUBSUB_TOPIC ?? '',
    // The real Google service account / Pub/Sub push-authentication audience this application
    // verifies incoming push requests against (Phase 21: "forged provider webhooks").
    pushAuthAudience: process.env.GOOGLE_INBOX_PUSH_AUTH_AUDIENCE ?? '',
  },

  microsoft: {
    webhookNotificationUrl: process.env.MICROSOFT_INBOX_WEBHOOK_URL ?? '',
    // A real, random, per-deployment secret Graph echoes back on every notification
    // (`clientState`) — this application rejects any notification whose clientState does not
    // match (Phase 21: "provider authenticity checks").
    webhookClientState: process.env.MICROSOFT_INBOX_WEBHOOK_CLIENT_STATE ?? '',
  },
}));
