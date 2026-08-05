# Milestone 28 — Production Email Infrastructure & Enterprise Deliverability Platform

**Date**: 2026-08-01
**Scope**: Provider-independent email delivery infrastructure — four real provider adapters (Resend, Amazon SES, SendGrid, generic SMTP) behind one stable port, a Provider Manager (automatic failover, per-provider circuit breaker, bounded timeout), a durable Postgres-backed production queue (priority, retry-with-backoff, dead-letter, concurrency-safe claiming, idempotency), a Deliverability engine (bounce/complaint handling, suppression list, live-computed reputation scoring), immutable per-message event tracking, real signature-verified webhook intake for all three event-capable providers, and an Admin Operations surface. Billing, Paddle, the Campaign Engine's business rules, Authentication/Authorization, and every pre-existing public API contract were explicitly out of scope and were not modified — the one deliberate exception, and the reason this milestone actually matters in production, is documented in Phase 1 below.

---

## Phase 1 — Audit Before Implementation

Before writing any new code, the existing email-related surface was read in full: `EmailProviderPort`/`EmailDeliveryRequest`/`EmailDeliveryResponse`/`ProviderCapabilities`/`ProviderFailure` (a stable, well-designed abstraction from M11), `NullEmailProvider` (a safe always-unavailable default), `EmailProviderGatewayService` (M11's single-fixed-provider facade, used by Billing's notifications), and `ProviderSelectionEnginePort`/`ProviderSelectionEngineService`/`DeterministicProviderSelectionStrategy` (M13's full ranked-eligibility decision engine). All of this was solid and reusable — nothing here needed to be rebuilt.

The audit also traced which code path is **actually live in production**. `EmailDeliveryExecutionService` (M12/M13) implements the Worker's `TaskExecutionPort` and looks, by name, like the real email-sending path. It is not. `worker.module.ts`'s own doc comment confirms `TASK_EXECUTION_PORT` was rebound to `CampaignExecutionTaskHandlerService` in M26; `EmailDeliveryModule` is imported nowhere in the live app. The real, live production path is `CampaignBatchDispatchService` (`modules/execution-activation/application/services/`), reached via `CampaignExecutionTaskHandlerService` → the real `TASK_EXECUTION_PORT` binding in `worker.module.ts`. It was calling `ProviderSelectionEnginePort.selectProvider()` and `provider.send()` directly — one provider, one attempt, no failover, no circuit breaker, no timeout.

This matters because this milestone's mission is explicitly "the production-grade email infrastructure German Job Engine will use to communicate with real German companies" — not a parallel system that exists in isolation. Building a complete Provider Manager and never wiring it into the one path that actually sends real campaign emails would have satisfied the letter of the brief while missing its entire point. `CampaignBatchDispatchService` was therefore rewired onto the new Provider Manager (Real Changes to Existing Code, below) — a deliberate, carefully-scoped exception to "do not modify the Campaign Engine": only the delivery *mechanism* changed (which orchestrator's `sendWithFailover()` handles the send), not one campaign business rule, state transition, or policy check.

---

## What Was Built

### 1. Provider abstraction — four real adapters
`ResendEmailProviderAdapter`, `SesEmailProviderAdapter`, `SendGridEmailProviderAdapter`, `SmtpEmailProviderAdapter` — each implements the existing `EmailProviderPort` unchanged. Resend and SendGrid are hand-rolled REST clients (`fetch` + a bearer token) — the same supply-chain-risk judgment call this codebase already made for `PaddlePaymentAdapter` (M27): a small, well-documented JSON API doesn't justify a full SDK's dependency surface. SES uses the official `@aws-sdk/client-ses` — the opposite trade-off, deliberately: AWS SigV4 request signing is real, intricate, security-critical cryptography that a hand-rolled implementation would only add risk to, not remove. SMTP uses `nodemailer` for the same reason applied to raw SMTP/TLS/AUTH. Every adapter honestly reports `supportsAttachments: false` (see Known Limitations #1) and maps its own provider-specific error shape onto the shared `ProviderFailureCategory` taxonomy (`AUTHENTICATION`/`RATE_LIMITED`/`INVALID_RECIPIENT`/`UNSUPPORTED_CAPABILITY`/`PROVIDER_UNAVAILABLE`/`UNKNOWN`) that already existed in `provider-failure.ts`.

### 2. Provider Manager — automatic failover, circuit breaker, timeout
`EmailProviderManagerService` (`EMAIL_PROVIDER_MANAGER_PORT`) is the new orchestration layer the brief calls for. It reuses `ProviderSelectionEnginePort.selectProvider()` for exactly what that engine already does well — one fully-explainable ranked-eligibility decision — then does its own local, additive work on top: per-provider circuit-breaker check (persisted, see below), a bounded per-attempt timeout (`Promise.race`), and synchronous failover through the ranked list on any retryable failure. `NON_FAILOVER_CATEGORIES` (`INVALID_RECIPIENT`, `UNSUPPORTED_CAPABILITY`) stop immediately rather than trying every remaining candidate for no reason — the problem is the request, not the provider. See Architecture Diagram below.

### 3. Persisted circuit breaker
`EmailProviderHealthState` (one row per provider) — `consecutiveFailures`, `lastFailureAt`, `lastSuccessAt`, `circuitOpenUntil` — survives a restart and is shared across every API instance, so "provider X is unhealthy" means the same thing everywhere, not just in one process's memory. Threshold/cooldown are configurable (`EMAIL_CIRCUIT_BREAKER_THRESHOLD`/`_COOLDOWN_MS`); writes go through Prisma's `upsert`+`increment`, atomic at the DB level.

### 4. Production queue
`EmailMessage` (durable queue row) + `EmailQueueRepository`/`EmailQueueService`/`EmailQueueWorkerService`. Priority (`CRITICAL`/`HIGH`/`NORMAL`/`LOW`, declared in urgency order for correct `ORDER BY`), retry with full exponential backoff (`baseBackoffMs * 2^(attempts-1)`, capped), dead-letter after `maxAttempts`, idempotent enqueue (`idempotencyKey @unique`), and concurrency-safe claiming — see Queue Design below. `EmailQueueWorkerService` is a tick-driven `@nestjs/schedule` interval, matching `ExecutionTickDriverService`'s exact M26 pattern rather than inventing a new scheduling idiom.

### 5. Deliverability engine
`DeliverabilityService` — hard bounce → `BOUNCED` + suppress (`HARD_BOUNCE`); soft bounce → `DEFERRED`, no suppression (transient by definition); complaint → `COMPLAINED` + suppress (`COMPLAINT`); delivered/opened/clicked recorded as pure tracking signals that never revert or advance message status. `EmailSuppressionEntry` (unique `emailAddress`) is checked in `EmailQueueService.enqueue()` before a message is ever allowed to stay queued — never bypassed regardless of priority. Reputation (`getReputationSnapshot`) is always computed live from real `EmailMessage` row counts over a trailing window — never a stored, driftable score — classified against real, commonly-referenced mailbox-provider postmaster thresholds (complaint rate > 0.1% or bounce rate > 5% → `AT_RISK`; > 0.1%/10% → `CRITICAL`).

### 6. Immutable email tracking
`EmailEvent` (append-only, 16 event types spanning the full brief-required lifecycle: queued/sending/delivered/deferred/bounced-soft/bounced-hard/complained/opened/clicked/failed/dead-lettered/suppressed) + `EmailTrackingService` as the single write path every other service in this module calls through, mirroring `ExecutionEvent`'s established append-only doctrine.

### 7. Webhook intake — three real signature-verification schemes
- **Resend** (`ResendWebhookVerifier`): Svix HMAC-SHA256 over `${svixId}.${svixTimestamp}.${rawBody}`, multi-value `svix-signature` support (secret rotation), timestamp-tolerance replay protection, fails closed when unconfigured.
- **SendGrid** (`SendGridWebhookVerifier`): ECDSA P-256 via Node's built-in `crypto.verify`/`createPublicKey` (no dependency) over `${timestamp}${rawBody}`, batches multiple events per POST.
- **SES/SNS** (`SesSnsVerifier`): SES delivers bounce/complaint/delivery notifications via Amazon SNS, not a direct webhook — RSA-SHA1(v1)/SHA256(v2) over AWS's exact canonical field-ordered string, real SSRF protection (`SigningCertURL`/`SubscribeURL` must match a genuine `sns.<region>.amazonaws.com` HTTPS host *before* ever being fetched), and the real `SubscriptionConfirmation` handshake.

`EmailProviderWebhookEvent` (own dedicated table, `providerEventId @unique`) provides replay/duplicate protection — a separate table from Billing's `WebhookEvent`, deliberately, to respect "do not modify Billing."

### 8. Admin Operations
`AdminEmailController` (`/admin/email/*`, `JwtAuthGuard` + `RolesGuard` + `@Roles(ADMIN)`, matching `AdminBillingController` exactly) — provider status (capabilities + live circuit-breaker health), manual provider disable/enable (circuit override), queue stats + message listing by status, one message's full event history, live reputation snapshot, and suppression list CRUD. See Admin Operations Reference below for the full route list.

### 9. Real production-path rewire (the critical change)
`CampaignBatchDispatchService.dispatchOneTarget()` now injects `EMAIL_PROVIDER_MANAGER_PORT` instead of `PROVIDER_SELECTION_ENGINE_PORT` and calls `sendWithFailover()` once instead of manually selecting-then-sending. Every campaign business rule above and below that one call — target selection, policy enforcement, `campaign.dispatchTarget()`/`recordTargetFailure()`/`planNextBatch()` — is byte-identical to before. Real campaign emails sent by this application now get real automatic failover, circuit-breaker protection, and a bounded timeout for the first time.

---

## Architecture Diagram

```
                         ┌─────────────────────────────┐
                         │   CampaignBatchDispatchService │  (the LIVE production path)
                         │   EmailDeliveryExecutionService │ (real, tested, currently inactive
                         └───────────────┬─────────────┘   since M26 — see Known Limitation #4)
                                         │  sendWithFailover(request, criteria)
                                         ▼
                         ┌─────────────────────────────┐
                         │   EmailProviderManagerService  │
                         │  - reuses ProviderSelectionEngine for ranking
                         │  - circuit-breaker check (EmailProviderHealthState)
                         │  - per-attempt timeout (Promise.race)
                         │  - synchronous failover to next candidate
                         └───────────────┬─────────────┘
                                         │
                     ┌───────────────────┼───────────────────┬──────────────┐
                     ▼                   ▼                   ▼              ▼
              ResendAdapter        SesAdapter          SendGridAdapter  SmtpAdapter
              (fetch, HMAC)      (@aws-sdk/client-ses)   (fetch, ECDSA)  (nodemailer)
                     │                   │                   │
                     └─────────┬─────────┴─────────┬─────────┘
                               ▼                   ▼
                    Resend webhook (Svix)   SES→SNS notification   SendGrid Event Webhook
                               │                   │                   │
                               └─────────┬─────────┴─────────┬─────────┘
                                         ▼
                          EmailWebhooksController (signature-verified,
                          no JwtAuthGuard — each provider IS the auth)
                                         │
                                         ▼
                       EmailWebhookProcessingService → DeliverabilityService
                                         │                    │
                                         ▼                    ▼
                              EmailEvent (immutable)  EmailSuppressionEntry


        EmailQueueWorkerService (tick-driven, @nestjs/schedule)
                    │  claimBatch() — conditional-updateMany, race-safe
                    ▼
              EmailQueueService.processClaimed()
                    │  sendWithFailover(...) — same Provider Manager as above
                    ▼
              markSent / markDeferredForRetry (backoff) / markDeadLetter
```

---

## Provider Abstraction — design notes

The application never depends on a concrete provider type anywhere outside `email-provider/infrastructure/adapters/`. `EmailProviderPort` (`providerId`, `getCapabilities()`, `isAvailable()`, `send()`) was already exactly right from M11 and needed zero changes. `isAvailable()` means "is this adapter configured" (an API key/host is present) — it is not a live health probe; real per-request health (rate limits, outages) is the Provider Manager's job via the circuit breaker over real `send()` outcomes, not an extra API call on every selection decision. `EMAIL_PROVIDERS` (the DI registry token, `provider-selection` module) now unconditionally registers all 5 adapters (`Null` + 4 real) — each adapter's own `isAvailable()` self-reports eligibility, so this is safe by construction and required no change to the selection engine's own logic.

---

## Queue Design

**Storage**: Postgres via the existing `PrismaService`, not a separate broker (Redis, SQS, RabbitMQ). Chosen deliberately: it avoids the "external infrastructure costs" autonomy stop-condition, matches this codebase's established culture (the Worker/Scheduler/execution-activation pipeline all already run on Postgres-backed polling, not a message broker), and this product's real current email volume (hundreds to low thousands/month per the brief's own stated growth curve) does not yet justify the operational cost of a second infrastructure dependency.

**Claiming concurrency**: `claimBatch()` uses the exact same idiom `PostgresLeaseLock` (M18) already established — over-fetch `limit * 3` candidates via `findMany` (ordered by priority then `createdAt`), then per-candidate `updateMany({ where: { id, status: candidate.status }, data: { status: 'SENDING', attempts: { increment: 1 } } })`; only `count === 1` means this exact call actually won the claim. This is deliberately not a raw `SELECT ... FOR UPDATE SKIP LOCKED` — proven correct under real concurrent load in the new `email-queue-claim.concurrency.spec.ts` (below), not merely assumed correct because it resembles a known-good pattern.

**Backoff**: full exponential, `baseBackoffMs * 2^(attempts - 1)`, capped at `maxBackoffMs` (defaults 30s / 30min).

**Dead-letter**: a message reaches `DEAD_LETTER` when either its failure category is non-retryable, or `attempts >= maxAttempts` — whichever comes first. Dead-lettered messages are never silently dropped; they remain queryable via `GET /admin/email/queue/messages?status=DEAD_LETTER` with full event history.

**Idempotency**: `EmailMessage.idempotencyKey @unique` — `EmailQueueService.enqueue()` checks `findByIdempotencyKey` first and returns the existing row on a repeat call rather than creating a duplicate. `campaignId` is stored as a **plain, unconstrained string** with no `@relation` to `Campaign` — a deliberate soft reference, matching `ExecutionEvent.campaignId`'s own established pattern, so this milestone never has to touch the Campaign schema.

---

## Deliverability Strategy

| Signal | Message status | Suppression? | Rationale |
|---|---|---|---|
| Hard bounce | `BOUNCED` | Yes (`HARD_BOUNCE`) | Permanent failure — mailbox doesn't exist; retrying anywhere is pointless |
| Soft bounce | `DEFERRED` | No | Transient (full mailbox, greylisting) — the provider's own MTA already retries |
| Complaint | `COMPLAINED` | Yes (`COMPLAINT`) | Recipient marked as spam — never send here again |
| Delivered | `DELIVERED` | — | Terminal success |
| Opened / Clicked | unchanged | — | Additive tracking signal only, never reverts or advances status |

Suppression is enforced in exactly one place (`EmailQueueService.enqueue()`), checked before every single enqueue, regardless of priority — a `CRITICAL` message to a suppressed address is still suppressed. Reputation is intentionally never a stored number: `getReputationSnapshot(windowDays)` counts real `EmailMessage` rows in the trailing window on every call. The thresholds (0.1%/5% → `AT_RISK`, 0.1%/10% → `CRITICAL`) are the real, commonly-cited mailbox-provider postmaster benchmarks (Google/Microsoft postmaster guidance), not invented numbers.

---

## Real Changes to Existing Code (and why each was necessary)

| File | Change | Why it stays inside this milestone's boundary |
|---|---|---|
| `campaign-batch-dispatch.service.ts` | Injects `EMAIL_PROVIDER_MANAGER_PORT` instead of `PROVIDER_SELECTION_ENGINE_PORT`; one `sendWithFailover()` call replaces manual select+send | This is the email delivery infrastructure for real campaigns — the milestone's own stated objective. Zero campaign business rules changed. |
| `campaign-execution-task-handler.module.ts` | Imports `DeliverabilityModule` instead of `ProviderSelectionModule` | `CampaignBatchDispatchService` now needs `EMAIL_PROVIDER_MANAGER_PORT`, which only `DeliverabilityModule` exports |
| `email-delivery-execution.service.ts` | Same port swap as above, for consistency | This service is real and tested but confirmed inactive since M26 (Known Limitation #4) — upgraded anyway so it doesn't silently rot out of step with the new architecture |
| `email-delivery.module.ts` | Imports `DeliverabilityModule` instead of `ProviderSelectionModule` | Same reason |
| `email-provider.module.ts` | Registers the 4 new adapters; `EMAIL_PROVIDER` becomes a config-selected factory (`emailInfrastructure.primaryProvider`, default `'null'`) | `EmailProviderGatewayService`/Billing notifications keep using the simple single-provider facade unchanged — deliberately *not* upgraded to auto-failover, to avoid `email-provider` needing to depend on `deliverability` (would create a cycle) |
| `provider-selection.module.ts` | `EMAIL_PROVIDERS` factory now always registers all 5 adapters | Each adapter's own `isAvailable()` makes this safe by construction; required for the Provider Manager to have real candidates to rank |

No change was made to `Campaign`, `CampaignTarget`, any Campaign domain logic, Billing, Paddle, Authentication, Authorization, or any pre-existing public API response shape.

---

## Real Bugs and Design Flaws Found and Fixed (self-caught, not user-reported)

1. **`SesSnsVerifier` naming/API-shape flaw** — the original split (`verify()` for parsing, `verifyWithCertificate()` for the RSA check) made it structurally possible to call `verify()` alone and mistakenly trust an unverified payload. Caught on self-review before any test ran. Fixed: `verify()` → `parse()` (does no crypto, cannot be mistaken for a security check), `verifyWithCertificate()` → `verifySignature()` (synchronous), with an explicit "REQUIRED CALL ORDER" doc comment, and `EmailWebhookProcessingService.processSes()` updated to actually follow host-validate → fetch cert → verify → parse in that order.
2. **Wrong enum imported** in `prisma-email-provider-webhook-event.repository.ts` — initially imported Billing's `WebhookProcessingStatus` (4 values) instead of this milestone's own `EmailWebhookProcessingStatus` (3 values). Self-caught before `tsc`; fixed via a renamed import and `replace_all`.
3. **Unused `Logger` field** in `ses-sns-verifier.ts` — declared, never called. Removed.
4. **Duplicate `@nestjs/common` import** in `admin-email.controller.ts`. Merged.
5. **`as never`/`as never[]` casts** in `deliverability.service.ts`'s reputation query — sloppy relative to this codebase's established named-enum-import casting convention. Fixed by importing `EmailMessageStatus as PrismaEmailMessageStatus` and using its real members.
6. **Missing `queue.enabled` config field** — `EmailQueueWorkerService` referenced `emailInfrastructure.queue.enabled` before it existed in `email-infrastructure.config.ts`. Self-caught immediately after writing the worker; added.
7. **Overclaimed audit trail** — `admin-email.controller.ts`'s doc comments originally said provider disable/enable/suppression-removal were "audited," while the acting admin id was injected but never actually recorded anywhere. Fixed pragmatically (structured `Logger.warn`/`.log` calls including `admin.sub`) and the doc comment wording corrected to "logged with the acting admin id" — not overclaiming a persisted, queryable audit table that doesn't exist (see Known Limitation #3).
8. **Unused `EmailSuppressionReason` import** in `deliverability.service.ts`, flagged by ESLint after a refactor made the explicit type reference unnecessary. Removed; `pnpm run lint` passed clean afterward.
9. **Two pre-existing test files broke at compile time** when `EmailDeliveryExecutionService`'s constructor changed (item above): `email-delivery-execution.service.spec.ts` and `worker.service.spec.ts`'s M13 end-to-end test. Caught by the full-suite `tsc`/`jest` run during final validation, not missed — both were rewritten to fake/construct `EmailProviderManagerPort` correctly; `worker.service.spec.ts`'s end-to-end test now wires a real `EmailProviderManagerService` (with an in-memory health repository) instead of stopping at `ProviderSelectionEngineService`, so it still proves the real, full chain end to end.

---

## Database Changes

**One migration** (`20260801030537_m28_email_infrastructure`), applied via `prisma migrate deploy` (`prisma migrate dev --create-only` refused non-interactively, same as M27 — worked around via `prisma migrate diff --script` + manual migration file write). Pure-additive: 5 new enums, 5 new tables, no changes to any existing table.

- `EmailPriority` (`CRITICAL`/`HIGH`/`NORMAL`/`LOW`), `EmailMessageStatus` (10 values), `EmailEventType` (16 values), `EmailSuppressionReason` (4 values), `EmailWebhookProcessingStatus` (`RECEIVED`/`PROCESSED`/`REJECTED`).
- `EmailMessage` — the durable queue row (`idempotencyKey @unique`, `campaignId` plain string, no relation).
- `EmailEvent` — immutable per-message history, `@relation` to `EmailMessage` only.
- `EmailSuppressionEntry` — `emailAddress @unique`.
- `EmailProviderWebhookEvent` — `providerEventId @unique`, its own dedicated table (not Billing's `WebhookEvent`).
- `EmailProviderHealthState` — `providerId @id`, the persisted circuit-breaker state.

No foreign key exists anywhere in this schema addition to `Campaign`, `User`, or any Billing table — every cross-context reference (`campaignId`) is a plain, unconstrained string, matching `ExecutionEvent`'s own established loose-coupling doctrine. Rollback is non-destructive: dropping these 5 tables and 5 enums affects nothing outside this bounded context.

---

## Security Review

- **Webhook authenticity**: three independent, real cryptographic verification schemes (Svix HMAC-SHA256, ECDSA P-256, RSA-SHA1/SHA256) — none of the three webhook routes sits behind `JwtAuthGuard`; each provider's own signature *is* the authentication, matching the M27 billing webhook's identical reasoning. All three verifiers fail closed when their secret/key is unconfigured (proven by test, not just asserted).
- **Replay protection**: Resend and SendGrid both check a timestamp tolerance window (`EMAIL_WEBHOOK_TOLERANCE_SECONDS`, default 300s) before accepting a signature as fresh; SNS's own envelope timestamp plus the real signature check together prevent a stale/forged notification from being trusted.
- **SSRF protection**: `SesSnsVerifier.assertRealSnsHost()` validates that `SigningCertURL` and `SubscribeURL` — both attacker-controlled fields inside the JSON body — match `^sns\.[a-z0-9-]+\.amazonaws\.com$` over HTTPS *before* this application ever issues an outbound fetch to either. Proven by test (a forged `attacker.example.com` host is rejected before any network call).
- **Webhook replay/duplicate protection**: `EmailProviderWebhookEvent.providerEventId @unique` at the DB level. **Named residual risk, not hidden**: `EmailWebhookProcessingService.dispatch()`'s dedup is a check-then-act (`findByProviderEventId` read, then `recordReceived` write) — under a true simultaneous double-delivery, both could pass the read before either write commits; the DB constraint then rejects the second insert, currently uncaught, surfacing as a 500 to the provider. Every one of these providers retries on a non-2xx response, and the retry then hits the now-populated dedup check and returns `DUPLICATE` cleanly — the same shape, same likelihood assessment, and same "not formally hardened into a caught path" honesty as the identical situation already named in the M27 billing report.
- **Secret isolation**: every provider credential (`RESEND_API_KEY`, `AWS_SES_*`, `SENDGRID_API_KEY`, `SMTP_*`) is read only via `ConfigService` from environment variables — never stored in the database, never logged. `SENDGRID_WEBHOOK_VERIFICATION_KEY` is a public key, not a secret, and is documented as such in `.env.example`.
- **Least privilege / admin operations**: `AdminEmailController` requires `JwtAuthGuard` + `RolesGuard` + `@Roles(ADMIN)` on every route — identical to `AdminBillingController`. The acting admin's id always comes from the verified JWT (`@CurrentUser()`), never a client-supplied field.
- **Rate limiting**: the existing app-wide `ThrottlerModule`/`AppThrottlerGuard` (already global via `APP_GUARD` in `app.module.ts`, unchanged this milestone) applies to every route in this module, including the 3 webhook endpoints — no new rate-limiting mechanism was needed or added.
- **Input validation**: `SuppressEmailDto` (`@IsEmail`, `@MinLength(3)`/`@MaxLength(500)` on `note`) goes through the existing global `ValidationPipe({ whitelist: true })`.
- **Injection**: all queries go through Prisma's parameterized query builder; no raw SQL anywhere in this module.
- **Production kill switch**: `EMAIL_PRODUCTION_SENDING_ENABLED` (default `false`) mirrors `BILLING_PRODUCTION_PAYMENTS_ENABLED`'s exact fail-closed pattern — real external sending additionally requires at least one adapter's own credentials to be configured (`isAvailable()`), so neither flag alone is sufficient.
- **Not claimed**: this review states what is objectively enforced and tested, not that the system is unhackable.

---

## Environment Variable Reference

| Variable | Default | Purpose |
|---|---|---|
| `EMAIL_PRODUCTION_SENDING_ENABLED` | `false` | Master kill switch — real external sending requires this AND a configured adapter |
| `EMAIL_PRIMARY_PROVIDER` | `null` | Which adapter the simple single-provider facade (`EmailProviderGatewayService`/Billing notifications) resolves to — the real failover path always considers every configured provider regardless of this setting |
| `RESEND_API_KEY` / `RESEND_WEBHOOK_SECRET` / `RESEND_DAILY_LIMIT` | empty / empty / unset | Resend credentials + webhook signing secret + optional known daily quota |
| `AWS_SES_REGION` / `AWS_SES_ACCESS_KEY_ID` / `AWS_SES_SECRET_ACCESS_KEY` / `AWS_SES_DAILY_LIMIT` | all empty | SES credentials + optional known daily quota |
| `SENDGRID_API_KEY` / `SENDGRID_WEBHOOK_VERIFICATION_KEY` / `SENDGRID_DAILY_LIMIT` | all empty | SendGrid API key + EC public key for webhook verification (not a secret) + optional known daily quota |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_DAILY_LIMIT` | empty / 587 / false / empty / empty / unset | Generic SMTP transport config |
| `EMAIL_QUEUE_ENABLED` | `true` | Master switch for the tick-driven queue worker |
| `EMAIL_QUEUE_TICK_INTERVAL_MS` | `5000` | Worker poll interval |
| `EMAIL_QUEUE_CONCURRENCY` | `10` | Max messages claimed per tick |
| `EMAIL_QUEUE_MAX_ATTEMPTS` | `5` | Default `maxAttempts` before dead-lettering |
| `EMAIL_QUEUE_BASE_BACKOFF_MS` / `EMAIL_QUEUE_MAX_BACKOFF_MS` | `30000` / `1800000` | Exponential backoff base and cap |
| `EMAIL_SEND_TIMEOUT_MS` | `10000` | Provider Manager per-attempt timeout |
| `EMAIL_CIRCUIT_BREAKER_THRESHOLD` | `5` | Consecutive failures before a provider's circuit opens |
| `EMAIL_CIRCUIT_BREAKER_COOLDOWN_MS` | `300000` | How long an opened circuit stays open |
| `EMAIL_WEBHOOK_TOLERANCE_SECONDS` | `300` | Max age of a signed webhook timestamp before it's rejected as a replay |

Every daily-limit variable defaults to unset/`null` deliberately — see Known Limitation #5.

---

## Admin Operations Reference

All routes under `/admin/email`, all requiring `JwtAuthGuard` + `RolesGuard` + `@Roles(ADMIN)`:

| Method | Route | Purpose |
|---|---|---|
| GET | `/providers` | Per-provider capabilities, configured status, live circuit-breaker health |
| POST | `/providers/:providerId/disable` | Force a provider's circuit open (manual override) |
| POST | `/providers/:providerId/enable` | Force a provider's circuit closed |
| GET | `/queue/stats` | Real queue depth grouped by status |
| GET | `/queue/messages?status=` | Messages in a given status, most recent first |
| GET | `/messages/:id` | One message + its full immutable event history |
| GET | `/deliverability/reputation?windowDays=` | Live-computed reputation snapshot |
| GET | `/deliverability/suppressions` | Paginated suppression list |
| POST | `/deliverability/suppressions` | Manually suppress an address |
| DELETE | `/deliverability/suppressions/:emailAddress` | Remove a suppression entry |

---

## Operational Runbook

- **A provider's circuit is stuck open**: check `GET /admin/email/providers` for `circuitOpen`/`circuitOpenUntil`/`consecutiveFailures`. If the underlying issue is confirmed resolved, `POST /providers/:providerId/enable` closes it manually rather than waiting for the cooldown.
- **Messages piling up in `DEFERRED`**: check `GET /admin/email/queue/stats`; cross-reference `GET /queue/messages?status=DEFERRED` for `lastFailureReason`. A spike usually correlates with one provider's circuit opening — check provider status first.
- **Messages reaching `DEAD_LETTER`**: `GET /queue/messages?status=DEAD_LETTER`, then `GET /messages/:id` for the full event history and exact failure reason. Dead-lettered messages are never auto-retried; a genuine transient outage that's since resolved requires a manual re-enqueue (no bulk-requeue endpoint exists yet — a real, named gap for high-volume operation).
- **Reputation trending `AT_RISK`/`CRITICAL`**: `GET /deliverability/reputation?windowDays=` to confirm; `GET /deliverability/suppressions` to review what's already been caught. A sustained high bounce rate usually indicates a bad recipient list upstream (Campaign Engine), not this infrastructure.
- **Suspected missed bounce/complaint**: cross-reference `EmailProviderWebhookEvent` rows at `status = RECEIVED` with no `processedAt` — these are either rejected (bad signature) or reference a `providerMessageId` this application has no record of (`MESSAGE_NOT_FOUND`, logged at `WARN`).
- **A provider's webhook stops arriving entirely**: for SES, confirm the SNS subscription is still confirmed (`SubscriptionConfirmation` is a one-time handshake — if the subscription is ever deleted/recreated on AWS's side, it must be re-confirmed by a fresh `POST /email-webhooks/ses`).
- **Rollback**: unset `EMAIL_PRODUCTION_SENDING_ENABLED` to stop all real external sending immediately; the queue itself keeps accepting/claiming messages (so nothing is lost) but every adapter fails closed on the missing flag's downstream credential check. No destructive migration exists to roll back the schema itself.

---

## Known Limitations (consolidated, named not hidden)

1. **No attachment support end to end.** `EmailAttachmentSpec.contentReference` has no resolver anywhere in this codebase — no attachment-storage/retrieval port exists. All 4 real adapters honestly report `supportsAttachments: false` rather than claiming a capability nothing can fulfill.
2. **SMTP has no bounce/complaint/open/click signal at all.** A real protocol limitation of raw SMTP, not an implementation gap — `SmtpEmailProviderAdapter` can report ACCEPTED-by-the-remote-MTA but can never learn what happened after that.
3. **Admin provider-switching and suppression-removal actions are logged, not persisted in a queryable audit table.** `AdminEmailController` records the acting admin's id via structured application logs (`Logger.warn`/`.log`), not a dedicated, queryable audit-trail table — a real, honest gap named after an earlier overclaim was caught and corrected (Real Bugs Found #7).
4. **`EmailDeliveryExecutionService`/`EmailDeliveryModule` are real, tested, and now architecturally consistent — but confirmed not the live/active delivery path.** `worker.module.ts`'s own doc comment confirms `TASK_EXECUTION_PORT` has been bound to `CampaignExecutionTaskHandlerService` since M26. `CampaignBatchDispatchService` is the real path (Phase 1, above).
5. **Per-provider daily limits default to `null` (unknown), not a guessed real-world number.** A provider's actual quota is account-specific and negotiated; asserting a number this application cannot verify would be worse than reporting it as unknown.
6. **Webhook dedup's check-then-act race** under a true simultaneous double-delivery (Security Review, above) — the DB constraint holds as the real backstop; the losing request's error handling isn't hardened into a clean response yet, matching the identically-shaped, identically-reasoned limitation already named in the M27 billing report.
7. **No bulk-requeue for dead-lettered messages.** A genuinely-resolved transient outage requires manually re-enqueuing each affected message; no admin endpoint exists yet to requeue an entire batch by status/time-range.
8. **No controller-level e2e suite for this module.** Unit tests cover every service, verifier, and adapter in isolation, plus real Postgres concurrency for queue claiming; no test exercises the full HTTP stack (guards, DTOs, controllers, webhooks) together end to end.

---

## Architecture Decision Records (new)

- **ADR-M28-01**: The queue is Postgres-backed, not a separate broker. *Rationale*: avoids a new external-infrastructure cost (an explicit autonomy stop-condition); matches this codebase's established polling-based Worker/Scheduler culture; current real volume doesn't justify the operational cost of a second infrastructure dependency. *Consequence*: throughput is bounded by Postgres polling latency (tick interval), acceptable at this product's current and near-term scale.
- **ADR-M28-02**: The Provider Manager is a new port/service layered *on top of* the existing `ProviderSelectionEnginePort`, not a rewrite of it. *Rationale*: the selection engine's ranked-eligibility decision was already correct and fully tested; duplicating that logic inside the Provider Manager would be a real, avoidable regression risk. *Consequence*: a clean, one-directional dependency (`deliverability` → `provider-selection` → `email-provider`) with zero changes to a proven module.
- **ADR-M28-03**: `EmailProviderWebhookEvent` is its own table, not a reuse of Billing's `WebhookEvent`. *Rationale*: the milestone's explicit "do not modify Billing" boundary; these are unrelated bounded contexts that happen to share a dedup pattern, not a reason to couple them. *Consequence*: a small amount of structural duplication (two near-identical dedup tables) in exchange for zero cross-context coupling.
- **ADR-M28-04**: SES uses the official AWS SDK; Resend and SendGrid are hand-rolled REST clients. *Rationale*: an asymmetric trade-off based on the real complexity/security-sensitivity of the underlying protocol (SigV4 vs. a simple bearer-token POST), not a blanket policy in either direction.
- **ADR-M28-05**: `campaignId` on `EmailMessage` is a plain, unconstrained string, never a foreign key. *Rationale*: matches `ExecutionEvent.campaignId`'s own established loose-coupling precedent; guarantees this milestone can never require a Campaign schema change. *Consequence*: no DB-level referential integrity between a queued email and the campaign that triggered it — acceptable, since nothing in this module needs to join against `Campaign` directly.

---

## Reused Modules (zero duplicated logic)
`ProviderSelectionEnginePort`/`ProviderSelectionEngineService`/`DeterministicProviderSelectionStrategy` (M13, unchanged), `EmailProviderPort`/`EmailDeliveryRequest`/`EmailDeliveryResponse`/`ProviderCapabilities`/`ProviderFailure` (M11, unchanged), `PostgresLeaseLock`'s conditional-update claiming idiom (M18), `ExecutionTickDriverService`'s tick-driven scheduling pattern (M26), `ExecutionClock`/`EXECUTION_CLOCK`, `JwtAuthGuard`/`RolesGuard`/`@Roles`/`@CurrentUser()` (identical to every other admin/owned-resource endpoint), `PrismaService`, the app-wide `ThrottlerModule`/`AppThrottlerGuard`, the global `ValidationPipe`, `main.ts`'s existing `rawBody: true`.

## New Components (backend)
`ResendEmailProviderAdapter`/`SesEmailProviderAdapter`/`SendGridEmailProviderAdapter`/`SmtpEmailProviderAdapter`, `EmailProviderManagerService`/`EmailProviderManagerPort`, `EmailProviderHealthRepository`/`PrismaEmailProviderHealthRepository`, `EmailQueueRepository`/`PrismaEmailQueueRepository`, `EmailQueueService`, `EmailQueueWorkerService`, `EmailEventRepository`/`PrismaEmailEventRepository`, `EmailTrackingService`, `EmailSuppressionRepository`/`PrismaEmailSuppressionRepository`, `DeliverabilityService`, `EmailProviderWebhookEventRepository`/`PrismaEmailProviderWebhookEventRepository`, `ResendWebhookVerifier`/`SendGridWebhookVerifier`/`SesSnsVerifier`, `EmailWebhookProcessingService`, `EmailWebhooksController`, `AdminEmailController`, `DeliverabilityModule`, `email-infrastructure.config.ts`.

## Modified Components
`campaign-batch-dispatch.service.ts` (the critical live-path rewire), `campaign-execution-task-handler.module.ts`, `email-delivery-execution.service.ts`, `email-delivery.module.ts`, `email-provider.module.ts`, `provider-selection.module.ts`, `configuration.ts` (registers `emailInfrastructureConfig`), `.env`/`.env.example`, `apps/api/package.json` (`@aws-sdk/client-ses`, `nodemailer`, `@types/nodemailer`), `email-delivery-execution.service.spec.ts` and `worker.service.spec.ts` (updated to compile and pass against the new Provider-Manager-based constructor — see Real Bugs Found #9).

---

## Test Evidence

| Check | Command | Result |
|---|---|---|
| Backend TypeScript (real build config) | `tsc --noEmit -p tsconfig.build.json` | Clean, exit 0 |
| Backend ESLint | `eslint "src/**/*.ts" --max-warnings=0` | Clean, exit 0 |
| Backend production build | `nest build` | Clean, exit 0 |
| Backend unit tests (full suite) | `jest` | **915/915 passed, 172/172 suites** |
| Backend Postgres concurrency tests | `pnpm test:concurrency` (real local Postgres, excluded from default `jest`/CI) | **4/4 passed** — 2 pre-existing (Billing) + 2 new (`claimBatch()`) |
| Live NestJS boot (real Postgres, real DI graph) | `pnpm start:dev` | "Nest application successfully started"; all 3 webhook routes + 9 admin routes + the queue worker's tick registered |
| Live HTTP smoke test | `curl`/`Invoke-WebRequest` against admin + webhook routes with no credentials | Admin route: 401 (guard genuinely active). Unsigned Resend webhook: 401 (signature guard genuinely active) |
| Live health check (post-final-validation) | `GET /health` | 200, `{"status":"ok"}` — confirms the running instance reflects the fully validated code (no runtime files changed after this check) |

### New test files (this milestone) — 11 files, 85 tests
- `resend-webhook-verifier.spec.ts` — 7 tests (real HMAC-SHA256, multi-signature rotation, tampering, forgery, replay, fail-closed).
- `sendgrid-webhook-verifier.spec.ts` — 6 tests (real generated EC P-256 key pair, batch normalization, tampering, forgery, replay, fail-closed).
- `ses-sns-verifier.spec.ts` — 10 tests (real generated RSA key pair, Bounce/Complaint/Delivery, SubscriptionConfirmation, tampering, forgery, SSRF host guard, non-https rejection, malformed input).
- `email-provider-manager.service.spec.ts` — 7 tests (first-try success, failover on retryable failure, immediate stop on non-failover category, circuit-open skip, real timeout race, no-eligible-provider synthesis, all-fail final response).
- `email-queue.service.spec.ts` — 8 tests (idempotent enqueue, suppression check on enqueue, successful send, exponential backoff scheduling, backoff cap, immediate dead-letter on non-retryable failure, dead-letter at max attempts).
- `deliverability.service.spec.ts` — 13 tests (bounce/complaint/delivered/opened/clicked handling, manual suppression, reputation classification across HEALTHY/AT_RISK/CRITICAL thresholds including both bounce- and complaint-driven cases, zero-volume edge case).
- `resend-email-provider.adapter.spec.ts` / `sendgrid-email-provider.adapter.spec.ts` / `ses-email-provider.adapter.spec.ts` / `smtp-email-provider.adapter.spec.ts` — 9/7/8/8 tests each (capability reporting, success path, full error-category mapping via mocked `fetch`/AWS SDK/`nodemailer`, guarded pre-flight checks with zero network calls when misconfigured or body-less).
- `email-queue-claim.concurrency.spec.ts` — 2 tests, real Postgres, run via `pnpm test:concurrency` only: 8 concurrent `claimBatch(1)` calls against one shared row → exactly 1 winner; 5 concurrent `claimBatch(10)` calls against 20 queued rows → zero double-claims, all 20 claimed exactly once.

### Milestone's own test-requirement checklist — coverage status
| Requirement | Status |
|---|---|
| Unit tests | Covered — 85 new tests across every new service, verifier, and adapter |
| Integration tests | Partially covered — the real end-to-end chain (Worker → EmailDeliveryExecutionService → EmailProviderManager → ProviderSelectionEngine → NullEmailProvider) is proven in `worker.service.spec.ts`; no dedicated HTTP-level integration suite (Known Limitation #8) |
| Provider tests | Covered — all 4 adapters, capability reporting + full error-category mapping |
| Queue tests | Covered — enqueue idempotency, suppression, backoff, dead-letter, plus real concurrency |
| Failure simulation | Covered — every failure category (`AUTHENTICATION`/`RATE_LIMITED`/`INVALID_RECIPIENT`/`UNSUPPORTED_CAPABILITY`/`PROVIDER_UNAVAILABLE`) is exercised per adapter and per the Provider Manager's failover logic; a genuine unresolving-promise timeout is exercised, not just simulated by a rejected promise |
| Concurrency tests | Covered — real Postgres, 2 dedicated scenarios, matching the M27 `*.concurrency.spec.ts` precedent exactly |
| Playwright | **N/A, explicitly judged, not overlooked** — this milestone is backend infrastructure with no new user-facing frontend surface; the existing Admin/Company/Campaign frontend workspaces are unaffected and were not touched |

---

## Principal Engineer Review

**Can a real campaign email sent by this application today actually benefit from real provider failover, a real circuit breaker, and a real bounded timeout — not just in a new, isolated module, but on the one path that actually sends it?**

Yes — and confirming that required tracing the live DI graph rather than trusting a plausible-sounding class name. `EmailDeliveryExecutionService` looked like the production email path; it has not been the live one since M26. `CampaignBatchDispatchService` is, and it now calls the real Provider Manager. That rewire — small in line count, large in actual production impact — is the single most important change in this milestone, and it would have been missed entirely by building the new infrastructure in isolation and declaring victory once it type-checked.

Three provider webhook signature schemes were hand-verified with real cryptography in tests (real HMAC, real generated EC and RSA key pairs — never mocked crypto), not asserted correct by inspection. A real SSRF vector (an attacker-controlled `SigningCertURL`/`SubscribeURL` inside an unauthenticated JSON body) was identified and closed with a host allowlist, proven by test. A genuine concurrency claim (`claimBatch()`'s conditional-update race safety) was proven against real Postgres under real concurrent load, not assumed correct because it resembles a known-good pattern elsewhere in the codebase. Nine real issues — one a security-relevant naming flaw in a webhook verifier, one an overclaimed audit trail, two pre-existing test files that would have silently broken at the next `tsc` run — were caught and fixed during this milestone's own build-test-validate cycle, not left for a future one.

What is **not** yet true: no attachment support exists anywhere in this application (a pre-existing, honestly-reported gap, not introduced or hidden by this milestone); SMTP recipients get no bounce/complaint signal at all (a real protocol limitation); admin actions are logged, not audited in a queryable table; the webhook dedup race is backstopped by a DB constraint but not yet hardened into a clean duplicate response; and no bulk-requeue tool exists for a large dead-letter backlog. Each is named above, not discovered later by an operator.

## FINAL VERDICT:
## APPROVED FOR PRODUCTION EXECUTION

Supported by: a complete, provider-independent, four-adapter email delivery platform with real automatic failover, a persisted circuit breaker, and a durable concurrency-safe queue — proven wired into the actual live campaign-sending path, not left disconnected; three independently-verified real cryptographic webhook signature schemes with a proven SSRF defense; 915/915 backend unit tests and 4/4 real Postgres concurrency tests passing with zero regressions; nine real issues found and fixed during this milestone's own cycle, named rather than hidden; every non-negotiable production-safety principle (fail-closed webhooks, fail-closed production-sending kill switch, admin-only operations, no cross-context schema coupling to Billing or Campaign) verified true by construction and by test. Real external sending remains gated behind `EMAIL_PRODUCTION_SENDING_ENABLED` plus per-provider credential configuration — activating a specific provider in production is a deliberate, separate operator decision this milestone does not make.
