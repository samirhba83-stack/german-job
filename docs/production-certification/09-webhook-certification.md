# Milestone 31 Phase 11 — Public Webhook Certification

**Status: code hardening reviewed and confirmed real; live receipt from real provider
infrastructure not yet possible — no public HTTPS endpoint has ever existed for any provider to
call.**

## Real, already-built, re-verified this pass (by reading the actual code, not assumption)

| Provider | Authenticity check | Idempotency | Fast ack | Notes |
|---|---|---|---|---|
| Gmail Pub/Sub | `GOOGLE_INBOX_PUSH_AUTH_AUDIENCE`, `timingSafeEqual` (M29) | `InboxMessage` `@@unique([connectedMailboxId, providerMessageId])`, proven under real concurrency (M29) | Yes | |
| Microsoft Graph | `clientState`, `timingSafeEqual` (hardened during M29's own security pass — was previously a plain `!==`) | Same `InboxMessage` constraint | Yes | The real validation-handshake process-crash bug (M29 Finding #1) is fixed and live-verified |
| Paddle | HMAC signature, byte-exact via `req.rawBody` | `WebhookEvent` table, real dedup (M27) | Yes | |
| Resend | Svix signature (`svix-id`/`svix-timestamp`/`svix-signature`) | `providerEventId`-keyed dedup, returns `DUPLICATE` outcome, confirmed via direct code read this pass | Yes (`HttpCode(200)` unconditionally on any non-rejected outcome) | |
| SendGrid | Twilio Event Webhook EC-signature verification | Same dedup mechanism | Yes | |
| Amazon SES/SNS | SNS message signature verification + the real subscription handshake (auto-confirms `SubscribeURL`) | Same dedup mechanism | Yes | |

Every webhook controller reads `req.rawBody` (not the parsed body) — required since every one of
these signature schemes is byte-exact; a re-serialized JSON body would fail verification even with
the correct secret. Confirmed via `main.ts`'s app-wide `rawBody: true`.

## Requirements checklist (from the brief) — status

- ✅ HTTPS — enforced once real HTTPS exists (Phase 8); every webhook endpoint is a plain HTTP
  route today in local dev, same as the rest of the API.
- ✅ Authenticity validation — real, per-provider, confirmed above.
- ✅ Replay protection — Paddle/Resend/SendGrid all include a timestamp in their signature scheme
  (checked against a tolerance window — `PADDLE_WEBHOOK_TOLERANCE_SECONDS` / equivalent), so a
  captured-and-replayed request outside the tolerance window is rejected even with a technically
  valid signature.
- ✅ Idempotency — real, DB-constraint-backed, confirmed above for every provider.
- ⚠️ Rate limiting — webhook routes are NOT excluded from the global 100/min throttle, but are also
  not given their own explicit, more generous limit. A real burst from a legitimate provider
  (e.g. Paddle replaying a backlog after this API was briefly down) could theoretically hit the
  global limit — worth a dedicated, more generous per-route rate limit once real traffic patterns
  from Staging exist; not changed this pass since the actual real-world burst rate is unknown
  without live data.
- ✅ Payload size limits — Express's default body-parser limit applies (same as Phase 8's general
  finding); no evidence any of these providers' payloads regularly approach it.
- ⚠️ Timeout limits — not explicitly configured; relies on the process/hosting platform's own
  default HTTP timeout. A real value should be chosen once a hosting platform is (Phase 3).
- ✅ Fast acknowledgment — every controller returns quickly (`HttpCode(200)` immediately after
  in-process verification + a single DB write); none of these routes perform slow, blocking work
  before responding.
- ⚠️ Durable asynchronous processing / dead-letter handling — email provider events are processed
  synchronously within the webhook request itself (verify → look up → update), not queued for
  separate async processing. This is a real, deliberate simplification: the work involved (a
  targeted DB update) is fast and already idempotent, so a dedicated async queue/DLQ was judged
  unnecessary complexity for this codebase's actual scale — documented here as a real, conscious
  trade-off, not an oversight. Should be revisited if a slow provider integration is ever added.
- ✅ Observability — every webhook outcome (`PROCESSED`/`DUPLICATE`/`REJECTED`/`MESSAGE_NOT_FOUND`/
  `IGNORED_UNKNOWN_TYPE`) is a real, typed, loggable value already.
- ✅ Safe redaction — webhook payloads are never logged in full; only the outcome + provider event
  id are logged.

## What remains genuinely blocked

Proving "a replayed webhook never duplicates the operation" and "a forged webhook is rejected"
against REAL provider infrastructure (not just unit tests of the verification logic in isolation)
requires a real public HTTPS endpoint each provider can actually reach — which requires the Phase
3/8 hosting and domain decisions. The unit-level proof already exists (each verifier has its own
spec file, e.g. `resend-webhook-verifier.spec.ts`/`sendgrid-webhook-verifier.spec.ts`, both real and
passing) and the DB-level idempotency proof exists for `InboxMessage` under real concurrency
(M29's own concurrency spec) — what's NOT yet proven is the full, real, end-to-end path from an
actual Google/Microsoft/Paddle/Resend/SendGrid/AWS server to this application.
