# Production Safety Gates — Inbox Intelligence

Source of truth: `apps/api/src/config/inbox-intelligence.config.ts`. Every gate below defaults to
the safe/disabled state, matching the established pattern from `EMAIL_PRODUCTION_SENDING_ENABLED`
(M28), `EMAIL_ATTACHMENTS_PRODUCTION_ENABLED` (M28.5), and
`CONNECTED_MAILBOX_PRODUCTION_SENDING_ENABLED` (M28.6).

## The 4 named gates from the brief

| Env var | Default | What it actually gates |
|---|---|---|
| `CONNECTED_INBOX_PROCESSING_ENABLED` | `false` | `InboxWatchRenewalTickDriverService` registers no renewal tick at all while false (verified live: boots with a `WARN` log, not silently) |
| `INBOX_AI_CLASSIFICATION_ENABLED` | `false` | Not read anywhere in code this milestone — the real gate is `DisabledAiClassificationAdapter.available = false`, which is what `ReplyIngestionService` actually checks before ever calling `classify()`. This env var is reserved for the future adapter swap. |
| `INBOX_REPLY_DRAFTING_ENABLED` | `false` | Checked in **both** `ReplyDraftService.createDraft()` and `approveAndSend()` — the second check was added during this milestone's own security review so disabling the flag mid-incident stops an already-created draft from being sent, not just new draft creation |
| `INBOX_AUTOMATIC_REPLY_ENABLED` | `false` | Deliberately wired to nothing — no code path in this module reads it to decide whether to skip user approval; `approveAndSend()` requires an explicit HTTP request unconditionally. The flag exists to make the "no automatic sending" intent auditable in config, per the brief's own instruction. |

## Every other real env var this milestone introduces

| Env var | Default | Purpose |
|---|---|---|
| `INBOX_CONSENT_VERSION` | `1.0` | Recorded on `ConnectedMailbox.inboxConsentVersion` at grant time |
| `INBOX_EXCERPT_RETENTION_DAYS` | `90` | This milestone's confirmed retention decision — sanitized excerpts pruned after this many days; provider ids, classification, and audit history are kept regardless |
| `INBOX_MAX_MESSAGE_SIZE_BYTES` | `5242880` (5 MB) | The privacy-gate size bound — content is never fetched for a message metadata reports as larger than this |
| `INBOX_WATCH_RENEWAL_HORIZON_HOURS` | `24` | How far ahead of real provider expiry a watch is considered due for renewal |
| `INBOX_WATCH_RENEWAL_TICK_INTERVAL_MS` | `3600000` (1h) | How often the renewal tick driver checks |
| `INBOX_POLLING_ENABLED` | `true` | The one shared polling mechanism used both as local-dev fallback (no public webhook URL needed) and missed-notification recovery |
| `INBOX_POLLING_TICK_INTERVAL_MS` | `120000` (2m) | Poll frequency — matches the live-verified boot log (`Inbox polling tick registered every 120000ms`) |
| `GOOGLE_INBOX_PUBSUB_TOPIC` | `''` | Real Google Cloud Pub/Sub topic Gmail's `watch()` publishes to |
| `GOOGLE_INBOX_PUSH_AUTH_AUDIENCE` | `''` | The shared secret checked via `timingSafeEqual` on every Gmail push |
| `MICROSOFT_INBOX_WEBHOOK_URL` | `''` | The public URL registered with Graph at subscription-creation time |
| `MICROSOFT_INBOX_WEBHOOK_CLIENT_STATE` | `''` | The shared secret Graph echoes back on every notification, checked via `timingSafeEqual` (fixed to timing-safe during this milestone's security review — see [threat-model.md](./threat-model.md)) |
| `CONNECTED_MAILBOX_MESSAGE_ID_DOMAIN` | `mail.germanjobengine.internal` | (M28.6, reused) domain used in the synthetic `Message-ID` header Gmail sends generate, needed for reply correlation |

## Live-verified boot behavior (this session, current build)

```
[InboxPollingTickDriverService] Inbox polling tick registered every 120000ms.
[InboxWatchRenewalTickDriverService] Inbox processing is disabled (CONNECTED_INBOX_PROCESSING_ENABLED=false) — no watch-renewal tick registered.
```

## Before real production activation (not done this milestone)

1. Register real Google Cloud Pub/Sub topic + push subscription; set `GOOGLE_INBOX_PUBSUB_TOPIC` / `GOOGLE_INBOX_PUSH_AUTH_AUDIENCE`.
2. Register the Graph webhook URL over real HTTPS (Graph requires HTTPS, will reject a validation handshake over HTTP); set `MICROSOFT_INBOX_WEBHOOK_URL` / `MICROSOFT_INBOX_WEBHOOK_CLIENT_STATE`.
3. Flip `CONNECTED_INBOX_PROCESSING_ENABLED=true` only after both provider integrations are confirmed reachable from the deployed environment.
4. `INBOX_AI_CLASSIFICATION_ENABLED` / a real `AiClassificationPort` adapter, `INBOX_REPLY_DRAFTING_ENABLED`, and `INBOX_AUTOMATIC_REPLY_ENABLED` are each separate, explicit future decisions — none is implied by turning on `CONNECTED_INBOX_PROCESSING_ENABLED`.
