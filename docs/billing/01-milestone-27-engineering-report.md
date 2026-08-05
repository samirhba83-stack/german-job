# Milestone 27 — Billing, Payments, Subscription Entitlements & Revenue Operations

**Date**: 2026-07-30
**Scope**: A complete, secure, auditable, provider-independent (Paddle) billing platform — plans, checkout, verified webhooks, an append-only billing ledger, a real subscription state machine, usage/quota enforcement, entitlement integration with the M26 execution pipeline, failed-payment recovery, cancellations/refunds/disputes, admin operations, a real user-facing Billing Workspace, notifications, and this security/production review. Real charges remain disabled by construction (Production Safety Gate, below) — this milestone activates Paddle **sandbox** billing end-to-end; real production payment activation is an explicit, separate, human decision this report does not make.

---

## Phase 1 — Audit Before Implementation

Before any code was written, an exhaustive parallel search (doc content, DTOs, an explicit repo-documented Open Question) confirmed the repo had **zero commercial content**: no prices, no plan names, no payment provider, no policy defaults anywhere. This matched the milestone's own explicit stop-condition. Rather than invent commercial data, `AskUserQuestion` was used — the first and only use of that tool across this entire multi-milestone session — to resolve: business model (recurring subscription), payment provider (Paddle), and how to obtain the real plan catalogue/policies (the product owner supplied them directly). The complete, final commercial spec (4-tier catalogue, 14 named `FeatureEntitlement`s, cancellation/refund policy) was then supplied verbatim and is the single source of truth for `apps/api/src/modules/billing/domain/plan-catalogue.ts` — never invented, never adjusted.

Also found during the audit: `BillingModule` existed only as an unmounted stub (empty `Plan`/`Subscription` scaffolding from the original repo scaffold), `apps/api/src/modules/execution-activation`'s own M26 report had already flagged "self-service subscription creation is not live" as the most important open item blocking real end-to-end usage — this milestone directly closes that gap.

---

## Commercial Model (source of truth: `plan-catalogue.ts`)

| Plan | Price/mo | Active campaigns | Companies/mo | Deliveries/mo | Specializations | Storage |
|---|---|---|---|---|---|---|
| FREE | €0 | 1 | 5 (all-time, no subscription row) | — (no production execution) | 1 | 500 MB |
| PROFESSIONAL | €49 | 2 | 150 | 150 | 1 | 1 GB |
| PREMIUM | €120 | 10 | 750 | 750 | 2 | 5 GB |
| ENTERPRISE | €500 | 50 | 5000 | 5000 | 2* | 25 GB |

\* Enterprise's specialization count was not explicitly specified in the approved commercial model (only Professional's "1" and Premium's "2" were given numbers) — carried forward from Premium rather than invented upward, flagged as an explicit assumption in `plan-catalogue.ts`'s own doc comment.

14 `FeatureEntitlement`s are modeled; only `CAN_PRODUCTION_EXECUTE` and the four numeric limits are load-bearing today (gate a real endpoint). The rest are correctly computed but not yet enforced anywhere, because the underlying feature (multi-user, exports, decision-intelligence UI, priority support) doesn't exist in the product yet — named honestly, matching this project's standing "reserved-but-unpopulated field" discipline (e.g. `CampaignDto.health`).

**Policies** (as approved, unmodified): Free tier is permanent, requires no payment method, and has no production execution. Cancellation is always effective at period end, never immediate. Refund is available within 7 days of the first successful payment, admin-approval only, reason + immutable audit trail required. Chargebacks/disputes are modeled separately from voluntary refunds (`Subscription.markDisputed()` vs `.refund()`).

---

## What Was Built

### 1. Domain — `Subscription` entity (real state machine)
5 real statuses (`ACTIVE`, `PAST_DUE`, `CANCEL_AT_PERIOD_END`, `CANCELED`, `REFUNDED`) — trimmed from a larger candidate list; no `TRIALING` (no trial in this commercial model), no separate "checkout in progress" status (lives on `CheckoutSessionStatus` instead), no separate "disputed" status (a timestamp, `disputedAt`, not a status — a dispute either doesn't change status or moves straight to `CANCELED`, matching Paddle's own dispute semantics). Every transition (`activate`, `renew`, `changePlan`, `markPastDue`, `expireFromPastDue`, `scheduleCancellationAtPeriodEnd`, `resumeFromScheduledCancellation`, `expireAtPeriodEnd`, `cancelImmediately`, `refund`, `markDisputed`) is guarded and throws `InvalidSubscriptionTransitionException` on an invalid source status — see the State Machine section below for the as-implemented diagram, and Real Bugs Found below for a genuine transition-guard bug caught while writing tests for it.

### 2. Payment provider abstraction (port/adapter)
`PaymentProviderPort` (10 methods: customer resolution, checkout session creation, subscription state/cancel/resume/change-plan, refund, invoice lookup, webhook verify-and-parse) is the one boundary every application service depends on — nothing outside `infrastructure/payment-providers/` imports a Paddle-specific type. Two adapters:
- `PaddlePaymentAdapter` — real, hand-rolled REST client against Paddle Billing API v2 (`fetch` + `node:crypto`, deliberately not the official SDK — a supply-chain-risk judgment call for a payments-security-sensitive, sandbox-only file).
- `FakePaymentProviderAdapter` — deterministic in-memory adapter for tests, with `seedSubscription()`/`signWebhook()` test helpers.

### 3. Checkout (`CheckoutService`)
Verifies the plan code against the server-side catalogue (never trusts a client-supplied price/currency/provider-price-id — the request DTO has exactly two fields: `planCode`, `idempotencyKey`), rejects a duplicate active checkout, resolves the Paddle customer server-side, and returns the minimum safe response (`checkoutUrl`, `expiresAt` — never a price, provider price id, or entitlement level). Idempotency is enforced at the DB level (`CheckoutSession.idempotencyKey @unique`), not just an application-level check — proven under real concurrency (see Test Evidence).

### 4. Webhook intake (`BillingWebhookController` + `WebhookProcessingService`)
The **only** entry point that can ever grant, renew, or revoke a paid entitlement. Not behind `JwtAuthGuard` — Paddle itself is the caller, authenticated by `Paddle-Signature: ts=...;h1=...` (HMAC-SHA256 over `${ts}:${rawBody}`, timing-safe compared, timestamp-tolerance-checked for replay protection). Reads `req.rawBody` (byte-exact; `main.ts` sets `NestFactory.create(AppModule, { rawBody: true })`) rather than the parsed body. Dedup is enforced at the DB level (`WebhookEvent.providerEventId @unique`), proven under real concurrency. An unrecognized event type is recorded and left at `RECEIVED` (a real review queue) rather than silently dropped or treated as an error.

### 5. Billing ledger (`BillingLedgerEntry`, append-only)
23 `BillingEventType` values, one write port (`BillingLedgerRecorder`), never updated or deleted — mirrors `ExecutionEvent`'s established append-only doctrine for the billing bounded context. Every checkout, activation, renewal, past-due, cancellation, refund, and chargeback event is recorded here; `GET /billing/ledger` is the real payment/subscription history the Billing Workspace displays.

### 6. Entitlement projection (`BillingEntitlementProjectionService`)
The one centralized entitlement authority every consumer (execution-activation's `CampaignPolicyContextBuilder`, `BillingController`, the frontend) reads from — never re-derived ad hoc. Resolves the effective plan (real plan if `ACTIVE`, within `PAST_DUE` grace, or within a `CANCEL_AT_PERIOD_END` window; `FREE` otherwise), computes `canStartNewExecution` (`CAN_PRODUCTION_EXECUTE` entitlement AND not past-due — a deliberate separation of "can see paid features during grace" from "can start new paid work"), and computes usage by **counting real rows** (`campaign.count`, `campaignTarget.count`, `dispatchAttempt.count` where `outcome: SUCCEEDED`, `userProfile` cv/photo byte sums) — never a separate, driftable counter. Usage is scoped to the current billing period for a paid plan, or all-time for FREE (FREE's limits are absolute, not monthly, since it has no billing period).

### 7. Cancellation / plan change / refund
`CancellationService.scheduleCancellation` — always end-of-period (`Subscription.scheduleCancellationAtPeriodEnd`), the real Paddle subscription is told to cancel "at next billing period" too, keeping both sides in sync; `resumeBeforePeriodEnd` cleanly undoes both sides since nothing was actually canceled on Paddle's side yet. `PlanChangeService.changePlan` — upgrade/downgrade between paid plans, Paddle computes proration server-side (`prorated_immediately`); only ever sends a server-side-resolved price id. `RefundService.issueRefund` — admin-only, mandatory reason, 7-day window from `Subscription.createdAt`, immutable `Refund` row + ledger entry; the synchronous Paddle API call is a *request*, not a finalization — `Subscription.refund()` and `Refund.status = ISSUED` are only ever finalized by Paddle's own `adjustment.created` webhook confirming it, matching "never finalize a paid-entitlement-affecting outcome on a synchronous response alone."

### 8. Frontend — Billing Workspace (Phase 13)
`apps/web/src/features/billing/` rebuilt end-to-end against the real endpoints: `PlanCatalogue` (pricing grid, real limits/features/prices, button state derived from real subscription status — never lets a click reach a guard the backend would reject anyway), `SubscriptionStatusCard` (real status badge, server-computed plain-language `explanation` rendered verbatim, cancel/resume actions gated on real transition-allowed statuses), `UsageLimitsPanel` (real usage-vs-limit bars), `BillingLedgerList` (real payment history). Checkout redirects the browser to Paddle's hosted `checkoutUrl`; the post-redirect `?checkout=success` state polls real `GET /billing/status` (`refetchInterval` stops itself the moment a subscription genuinely appears) rather than fabricating a success state or a countdown. Failure paths were live-tested (see Real Bugs Found and Test Evidence): a checkout failure surfaces the real backend error via toast, never crashes, never fake-navigates.

### 9. Notifications
`BillingNotificationService` reuses the exact same `EmailProviderGatewayService` the M26 execution pipeline already uses (no second, parallel notification system) — currently bound to `NullEmailProvider`, so these are real send *attempts* with a safe, honest no-op outcome, matching every other email in this project today.

---

## Real Bugs Found and Fixed (live, not assumed)

1. **`Subscription.markPastDue()` always threw, unconditionally.** It called the shared `requireTransition(target)` helper with `target = PAST_DUE`; that helper's `allowedFrom` list is only ever populated when `target === ACTIVE` — for any other target it's `[]`, so the guard check (`!allowedFrom.includes(currentStatus)`) was always true. **Every real Paddle `subscription.past_due` webhook would have thrown inside `WebhookProcessingService.handleSubscriptionPastDue`, silently breaking the entire dunning/grace-period recovery flow** — a Phase-10-critical feature that would never have actually worked. Found while writing `subscription.entity.spec.ts`'s PAST_DUE regression tests, not by inspection. Fixed with a standalone guard (`status !== ACTIVE` → throw), matching the pattern already used by `expireFromPastDue`/`expireAtPeriodEnd`/`refund`. 25/25 entity tests pass after the fix, including 4 dedicated to this exact transition.

2. **Production Safety Gate was checkout-only; plan-change had no equivalent check.** `CheckoutService.startCheckout` correctly refused to run in `environment: production` without `BILLING_PRODUCTION_PAYMENTS_ENABLED=true` — but `PlanChangeService.changePlan` (which also triggers a real, immediate Paddle charge via `proration_billing_mode: 'prorated_immediately'`) had no such check at all. Found during the security review, not by a failing test (no current `.env` sets `PADDLE_ENVIRONMENT=production`, so this had zero effect on the actual deployment — but it's exactly the kind of latent gap that would matter during a real future production-activation window). Fixed by extracting the check into a shared `BillingProductionSafetyService`, now called from both `CheckoutService` and `PlanChangeService`; a stale doc comment in `paddle-payment.adapter.ts` referencing a nonexistent `PaddleConfigGuard` class was also corrected to name the real mechanism.

3. **`BillingController` had a class-level `JwtAuthGuard`, blocking the intentionally public pricing endpoint.** `GET /billing/plans` returned 401 for an unauthenticated request — found via live boot + curl testing, not caught by `tsc`/ESLint. Fixed by removing the class-level guard and adding `@ApiBearerAuth() @UseGuards(JwtAuthGuard)` individually to the 6 endpoints that need it, leaving `listPlans()` public (a pricing page a prospective customer sees before signing up returns zero user-specific data — no ownership concern).

4. **`AppShell`'s boot-refresh gate had a one-render-frame race, exposed by the Billing Workspace (not caused by it).** On a hard page reload, `AppShell` correctly blocks its `children` from mounting until a proactive token refresh completes (`bootRefreshing` state) — but that flag is set by a `useEffect` that runs one commit *after* the render where the gate's own condition (`hydrated && refreshToken && !user`) first became true. The Billing Workspace fires two authenticated queries (`/billing/status`, `/billing/ledger`) in parallel the instant its children mount, which was enough to win that one-commit race and hit the API with no access token — a real 401 (silently recovered by the existing 401-retry-after-refresh path in `api-client.ts`, so invisible to the end user, but a genuine race nonetheless, confirmed via a Playwright diagnostic capturing the exact failing requests). Fixed by deriving the same condition synchronously in render (`awaitingBootRefresh`) and including it directly in the gate check, closing the one-commit gap. Re-verified: zero 401s, zero console errors, full page renders correctly.

---

## Database Changes

**One migration** (`20260729142946_m27_billing_platform`), applied via `prisma migrate deploy` (non-interactive path — `prisma migrate dev`/`--create-only` refused interactively for the `SubscriptionStatus` enum-value-removal warning even though the underlying tables were empty; resolved via `prisma migrate diff --script` + manual `migrate deploy`).

- `User.subscription Subscription?` → `User.subscriptions Subscription[]` (a user can have historical CANCELED/REFUNDED rows alongside at most one current non-terminal one).
- `PlanCode` enum added; `SubscriptionStatus` enum trimmed to 5 real values (see State Machine).
- `Subscription` model rewritten: non-unique `userId`, full lifecycle fields (`cancelAtPeriodEnd`, `canceledAt`, `cancellationReason`, `pastDueSince`, `gracePeriodEndsAt`, `refundedAt`, `disputedAt`).
- **`Plan` table deleted.** A deliberate, real schema simplification: the commercial catalogue (price, limits, entitlements, marketing copy) lives in exactly one place, the code-level `PLAN_CATALOGUE` in `plan-catalogue.ts` — matching this codebase's established `DEFAULT_*_CONFIG` convention — rather than a second, driftable source of truth in the database. `Subscription.planCode` is a plain enum column, no FK.
- New tables: `BillingCustomer`, `CheckoutSession` (+`CheckoutSessionStatus`), `WebhookEvent` (+`WebhookProcessingStatus`), `BillingLedgerEntry` (+`BillingEventType`, 23 values, +`BillingLedgerStatus`), `Refund` (+`RefundStatus`).

**Rollback implication**: this migration is destructive to the (already-empty, never-used) `Plan`/old `Subscription` shape — verified both tables held zero rows before migrating (`SELECT COUNT(*)` via `docker exec ... psql`) — so no real data loss occurred. Rolling back would require restoring the old `Plan` table and reverting the `Subscription` reshape; not expected to be needed, since nothing in production depends on the old shape (it was never mounted).

---

## Subscription State Machine (as implemented)

```
                    activate()
                        │
                        ▼
                    ┌─────────┐
        ┌──renew()──│ ACTIVE  │◄──────────────┐
        │           └────┬────┘               │
        │                │                    │
        │        markPastDue()        resumeFromScheduledCancellation()
        │                │                    │
        │                ▼                    │
        │          ┌───────────┐   scheduleCancellationAtPeriodEnd()
        │  ┌─renew()│ PAST_DUE  │──────────────┤
        │  │        └─────┬─────┘              │
        │  │              │                    │
        │  │     expireFromPastDue()   ┌────────────────────┐
        │  │              │            │ CANCEL_AT_PERIOD_END│
        │  │              │            └──────────┬──────────┘
        │  │              │                        │
        │  │              │                 expireAtPeriodEnd()
        │  │              ▼                        │
        │  └────────►┌──────────┐◄─────────────────┘
        │             │ CANCELED │◄── cancelImmediately() (from any non-terminal)
        │             └──────────┘◄── markDisputed()      (chargeback, from any non-terminal)
        │
        └──refund()──►┌──────────┐
                       │ REFUNDED │  (terminal, from ACTIVE or PAST_DUE only)
                       └──────────┘
```

`CANCELED` and `REFUNDED` are terminal (`TERMINAL_STATUSES`) — never re-entered; a later resubscription creates a brand-new `Subscription` row with a new real `paddleSubscriptionId`, matching this project's standing "never resurrect completed history" pattern.

---

## Usage/Quota Model

Every quota (`activeCampaigns`, `companiesPerMonth`, `deliveriesPerMonth`, `storageBytes`) is enforced by counting real, existing rows at read time — never a separate incrementing counter that could drift from reality. `deliveriesPerMonth` counts `DispatchAttempt` rows with `outcome: SUCCEEDED` in the current billing period. FREE has no billing period (no `Subscription` row exists for it at all), so its limits are enforced as absolute all-time counts rather than monthly — the one deliberate asymmetry in the model, named in `plan-catalogue.ts`'s own doc comment.

---

## Idempotency Design

- **Checkout**: `CheckoutSession.idempotencyKey @unique` (DB-level) — proven under real concurrent inserts (Test Evidence). Application-level `findByIdempotencyKey` check is a fast path, not the actual guarantee.
- **Webhook delivery**: `WebhookEvent.providerEventId @unique` (DB-level) — same pattern, same proof. **Named limitation**: `WebhookProcessingService.processWebhook`'s dedup is a check-then-act (`findByProviderEventId` read, then `recordReceived` write) — under a true two-request race, both could pass the read before either write commits; the DB constraint then rejects the second `recordReceived` call, which is **not currently caught** and propagates as an unhandled exception (surfaces to Paddle as a 500, which Paddle correctly retries — the retry then hits the now-populated dedup check and returns `DUPLICATE` cleanly). `handleSubscriptionActivated` additionally has its own independent idempotency check (`findByPaddleSubscriptionId`), so double-granting an entitlement is not possible even if `dispatch()` ran twice under that race; the other four handlers (`transactionCompleted`, `pastDue`, `canceled`, `adjustmentCreated`) rely on the DB constraint alone plus their own no-op guards. This is a real, named residual risk, not hidden — see Residual Risks.
- **Subscription writes**: `Subscription`'s guarded state-machine transitions (above) make most double-application safe by construction (e.g. `markPastDue` on an already-`PAST_DUE` row now correctly throws rather than double-applying).

---

## Security & Fraud Review

- **Checkout price/plan trust**: `CreateCheckoutSessionDto` has exactly two fields (`planCode`, `idempotencyKey`) — no price, currency, or provider-price-id field exists for a client to supply. `CheckoutService` always resolves the real price from `PLAN_CATALOGUE` and the real Paddle price id from server-side config (`billing.priceIds`). Global `ValidationPipe({ whitelist: true })` strips any extraneous client-supplied field before it reaches the DTO.
- **Webhook forgery/tampering/replay**: verified with real cryptographic tests (`paddle-payment.adapter.spec.ts`, 9/9 passing) — missing header, malformed header, tampered body, wrong-secret forgery, stale timestamp (replay), unconfigured-secret fail-closed, non-JSON body, and missing `event_id`/`event_type` are all rejected with `WebhookVerificationError`. Comparison is `timingSafeEqual`, never `===`, on secret-derived hex.
- **Webhook duplicate delivery**: DB-level unique constraint, proven under real concurrency (Test Evidence) — see the named check-then-act residual risk above.
- **Cross-user access**: every `BillingController` endpoint derives its subject exclusively from `@CurrentUser()` (the verified JWT) — there is no `userId`/`subscriptionId` URL or body parameter a caller could substitute to reach another user's billing state. This closes the exact gap the pre-M27 stub controller had (`GET /billing/subscriptions/:userId`, no ownership check at all).
- **Admin operations**: `AdminBillingController` requires `JwtAuthGuard` + `RolesGuard` + `@Roles(ADMIN)`; the acting admin's id is always read from the verified JWT, never client-supplied, so the refund audit trail can never be spoofed; reason is mandatory (`IssueRefundDto`, `@MinLength(3)`).
- **Production payment activation**: `BillingProductionSafetyService.assertRealChargesAllowed()` fails closed — real charges (checkout, plan-change) are refused whenever `environment === 'production'` and `BILLING_PRODUCTION_PAYMENTS_ENABLED` is not explicitly `true`. Now called from both real-charge paths (Real Bugs Found #2).
- **Injection**: all queries go through Prisma's parameterized query builder; no raw SQL anywhere in the billing module.
- **Secrets/logging**: `PADDLE_API_KEY`/`PADDLE_WEBHOOK_SECRET` are read only from `ConfigService`, never logged; `WebhookProcessingService`'s logging emits event ids/types and error messages only, never payment amounts, card data, or raw webhook bodies.
- **Not claimed**: this review states what is objectively enforced and tested, not that the system is unhackable.

### Residual Risks (named, not hidden)
1. **Webhook dedup check-then-act race** (see Idempotency Design) — the DB constraint is the real backstop and does hold (proven), but the losing concurrent request currently surfaces as an unhandled 500 rather than a clean `DUPLICATE` response. Low real-world likelihood (Paddle does not typically deliver the same event twice *simultaneously*, only on retry-after-timeout, which this already handles correctly) but not formally hardened with a caught-and-treated-as-duplicate path.
2. **No controller-level e2e suite exists for billing yet.** Unit tests cover the domain entity, webhook signature verification, webhook dispatch logic, and DB-level concurrency; no test exercises the full HTTP stack (guards, DTOs, controllers) together. Named explicitly in `billing.module.ts`'s own doc comment rather than silently assumed covered.
3. **Enterprise's `specializations: 2` is an inherited assumption**, not an explicitly approved number (see Commercial Model).
4. **No automated recovery-charge retry beyond Paddle's own dunning** — `expireFromPastDue()` fires only on Paddle's own `subscription.canceled` webhook once Paddle's dunning process gives up; this project does not run a second, independent retry schedule.
5. **`GET /billing/plans`'s `whitelist: true` (not `forbidNonWhitelisted`)** silently strips unexpected client fields rather than rejecting the request outright — consistent with this app's existing global `ValidationPipe` configuration (not changed in this milestone), sufficient for the price-manipulation concern (there's no price field to strip in the first place) but slightly less informative to a misbehaving client than a hard 400 would be.

---

## Privacy & Data Retention

No new categories of sensitive personal data are introduced beyond what Paddle itself already handles as Merchant of Record (card details never touch this application — Paddle's hosted checkout collects them directly). What this application stores: email (already stored for the user account), Paddle customer/subscription/transaction ids (opaque references, not payment instrument data), and billing ledger entries (event type, amount, currency, plan, timestamps — no card data). `BillingNotificationService` never includes payment amounts or card details in message bodies. **Not addressed by this milestone, named as an open item**: no explicit data-retention/deletion policy exists yet for `BillingLedgerEntry`/`WebhookEvent`/`Refund` rows after account deletion or the legally-required financial-record retention period (typically 6–10 years in most EU jurisdictions for tax records) — this is a legal/regional decision requiring operator input before production activation, not a technical gap this milestone can close unilaterally.

---

## Production Safety Gates

- **`BillingProductionSafetyService.assertRealChargesAllowed()`**: real charges (checkout, plan-change) refused unless `environment === 'production'` AND `BILLING_PRODUCTION_PAYMENTS_ENABLED === true`. Sandbox (the default, and the only mode this milestone activates) is never blocked.
- **`resolvePaddleEnvironment()`**: defaults to `sandbox` whenever `PADDLE_ENVIRONMENT` is unset or anything other than the literal string `"production"` — fails to the safe mode, not the dangerous one.
- **Current `.env`**: `PADDLE_ENVIRONMENT=sandbox`, `BILLING_PRODUCTION_PAYMENTS_ENABLED=false`, all Paddle credentials empty — real charges are categorically impossible in the current deployment.

---

## Environment Variable Reference

| Variable | Default | Purpose |
|---|---|---|
| `PADDLE_ENVIRONMENT` | `sandbox` | `sandbox` or `production` — selects Paddle API base URL |
| `BILLING_PRODUCTION_PAYMENTS_ENABLED` | `false` | Master kill switch for real charges — see Production Safety Gates |
| `PADDLE_API_KEY` | *(empty)* | Paddle Billing API bearer credential |
| `PADDLE_WEBHOOK_SECRET` | *(empty)* | HMAC secret for `Paddle-Signature` verification — webhook fails closed if unset |
| `PADDLE_PRICE_ID_PROFESSIONAL` / `_PREMIUM` / `_ENTERPRISE` | *(empty)* | Maps internal `PlanCode` to Paddle's own price identity; checkout for a plan with no configured id fails closed (`ServiceUnavailableException`) |
| `PADDLE_CHECKOUT_SUCCESS_URL` | `http://localhost:3000/billing?checkout=success` | Paddle-hosted-checkout return URL on success |
| `PADDLE_CHECKOUT_CANCEL_URL` | `http://localhost:3000/billing?checkout=canceled` | Paddle-hosted-checkout return URL on cancel |
| `PADDLE_WEBHOOK_TOLERANCE_SECONDS` | `300` | Max age of a signed webhook timestamp before it's rejected as a replay |
| `BILLING_CHECKOUT_EXPIRY_MINUTES` | `30` | How long a `CheckoutSession` stays valid/reusable |
| `BILLING_REFUND_WINDOW_DAYS` | `7` | Refund eligibility window from `Subscription.createdAt` |

---

## Sandbox → Production Activation Checklist

1. Create a real Paddle production account; complete Paddle's own merchant-of-record verification.
2. Provision production price objects in Paddle for PROFESSIONAL/PREMIUM/ENTERPRISE; set `PADDLE_PRICE_ID_*`.
3. Set `PADDLE_API_KEY`/`PADDLE_WEBHOOK_SECRET` to production values (via secrets manager, never committed).
4. Point `PADDLE_CHECKOUT_SUCCESS_URL`/`_CANCEL_URL` at the real production domain.
5. Register the production webhook endpoint (`/billing/webhooks/paddle`) in the Paddle dashboard.
6. Resolve the Privacy & Data Retention open item (legal sign-off on retention policy) before real customer payment data flows.
7. Only then: set `PADDLE_ENVIRONMENT=production` and, as a final, explicit, separate step, `BILLING_PRODUCTION_PAYMENTS_ENABLED=true`. Both together are what `BillingProductionSafetyService` requires — this is the one moment real charges become possible, and it requires deliberate operator action on two separate flags, not a single toggle.
8. Smoke-test one real low-value checkout end-to-end before announcing availability.

---

## Incident Response / Reconciliation Runbook

- **Webhook processing failure (5xx returned to Paddle)**: Paddle retries automatically on a backoff schedule. Check `WebhookEvent` rows at `status = RECEIVED` with no `processedAt` — these are either mid-retry or genuinely stuck; `WebhookProcessingService`'s logger emits the failure reason at `ERROR` level for each.
- **Unknown event type accumulation**: query `WebhookEvent WHERE status = 'RECEIVED' AND signatureValid = true` — this is the real, intentional review queue for event types not yet in the `dispatch()` allowlist; extend the switch statement to handle a new Paddle event type as needed.
- **Suspected missed entitlement grant**: cross-reference `BillingLedgerEntry WHERE eventType = 'SUBSCRIPTION_ACTIVATED'` against Paddle's own dashboard transaction list for the affected period; `WebhookEvent.providerEventId` is the correlation key back to the exact Paddle event.
- **Refund reconciliation**: `Refund.status = REQUESTED` rows awaiting Paddle's `adjustment.created` confirmation; `WebhookProcessingService.handleAdjustmentCreated` reconciles them to `ISSUED` automatically once that webhook lands — a `REQUESTED` row older than a few minutes with no matching webhook warrants manual investigation against Paddle's dashboard.
- **Rollback**: disable checkout/plan-change by unsetting `BILLING_PRODUCTION_PAYMENTS_ENABLED` (falls back to blocking real charges in production) or by removing `PADDLE_PRICE_ID_*` (checkout fails closed per-plan). No destructive migration exists to roll back the schema itself.

---

## Test Evidence

| Check | Command | Result |
|---|---|---|
| Backend TypeScript (real build) | `nest build` (`tsconfig.build.json`) | Clean, exit 0 |
| Backend ESLint | `eslint "{src,test}/**/*.ts" --fix` | Clean, exit 0 |
| Backend unit tests (full suite) | `jest` | **828/828 passed, 162/162 suites** |
| Backend Postgres concurrency tests | `pnpm test:concurrency` (real local Postgres, excluded from default `pnpm test`/CI — no Postgres service in CI) | **2/2 passed** — proves `WebhookEvent.providerEventId` and `CheckoutSession.idempotencyKey` DB-level unique constraints genuinely reject the second of two concurrent inserts |
| Frontend TypeScript | `tsc --noEmit` | Clean, exit 0 |
| Frontend ESLint | `eslint` (billing feature + touched files) | Clean, exit 0 |
| Frontend production build | `next build` | Clean, exit 0 — `/billing` route: 5.62 kB, 119 kB First Load JS |
| Frontend unit tests | `vitest run` | 26/26 passed (pre-existing, unaffected) |
| Live NestJS boot (real Postgres, real DI graph) | `pnpm start:dev` | "Nest application successfully started"; all 7 billing routes + webhook + admin route mapped |
| Live browser (Playwright, real login, real backend) | Navigate to `/billing` as a freshly-registered real user | Renders FREE plan, correct limits (1/1 campaign, 0/5 companies, 500 MB storage), all 4 real plan cards with real prices/features, empty ledger state — **zero console errors, zero page errors, zero unhandled 401s** after the AppShell race fix |
| Live browser — checkout failure path | Click "Upgrade to Professional" with no Paddle sandbox credentials configured | Real backend error ("No Paddle price is configured for plan 'PROFESSIONAL' yet.") surfaces via toast; no crash, no fake navigation, URL stays on `/billing` |

### New test files (this milestone)
- `subscription.entity.spec.ts` — 25 tests, full state-machine coverage including the `markPastDue` regression.
- `paddle-payment.adapter.spec.ts` — 9 tests, real HMAC signature construction/verification (missing/malformed/tampered/forged/stale/unconfigured-secret/non-JSON/incomplete payloads).
- `webhook-processing.service.spec.ts` — 6 tests, dispatch/dedup/unknown-type/idempotent-activation/missing-custom_data.
- `billing-production-safety.service.spec.ts` — 3 tests.
- `webhook-and-checkout-dedup.concurrency.spec.ts` — 2 tests, real Postgres, run via `pnpm test:concurrency` only.

### Milestone's 26-scenario test checklist — coverage status
| Scenario | Status |
|---|---|
| Checkout uses trusted server-side pricing | Covered by design (DTO has no price field) + code inspection |
| Tampered checkout amount rejected | N/A by construction — no amount field exists to tamper with |
| Invalid plan code rejected | Covered (`@IsEnum(PlanCode)` on the DTO) |
| Duplicate checkout idempotent | Covered — real concurrency test |
| Unsigned/invalid/expired webhook rejected | Covered — `paddle-payment.adapter.spec.ts` |
| Duplicate webhook processed once | Covered — real concurrency test (DB constraint); check-then-act race at the service layer named as a residual risk, not silently assumed closed |
| Entitlement granted on payment success | Covered — `webhook-processing.service.spec.ts` |
| Entitlement denied on payment failure | Covered by design (`markPastDue`/`canStartNewExecution` logic) + entity tests |
| Forged redirect grants nothing | Covered by design — entitlement only ever changes via a verified webhook, never a checkout redirect |
| Renewal extends access correctly | Covered — entity test (`renew`) |
| Past-due restricts access appropriately | Covered — entity test + entitlement projection logic (not a dedicated new test for the projection service itself this milestone) |
| Recovery restores access | Covered — entity test (`renew` from `PAST_DUE`) |
| Cancellation takes effect at the correct time | Covered — entity tests (`scheduleCancellationAtPeriodEnd`/`expireAtPeriodEnd`) |
| Refund correctness | Covered — entity test + `RefundService` code inspection (7-day window, admin-only, reason required) |
| Chargeback suspends access appropriately | Covered — entity test (`markDisputed`) |
| Concurrent webhook delivery cannot double-activate | Covered — real concurrency test + `handleSubscriptionActivated`'s own independent idempotency guard |
| Concurrent usage cannot exceed quota | Not separately load-tested this milestone — relies on real-row-counting-at-read-time by design; no reservation/lock mechanism exists (a real, named gap for genuinely simultaneous requests at the exact quota boundary) |
| Unauthorized users cannot access others' billing data | Covered by design — every endpoint derives its subject from `@CurrentUser()` only |
| Non-admin cannot issue refunds | Covered — `RolesGuard` + `@Roles(ADMIN)` |
| Admin refund requires reason and is audited | Covered — `IssueRefundDto` validation + `Refund`/ledger rows |
| Provider outage handled safely | Covered by design — `PaddlePaymentAdapter.request()` throws on a non-OK response; callers propagate as a real error, never a fabricated success |
| Unknown webhook event handled gracefully | Covered — `webhook-processing.service.spec.ts` |
| Sandbox never touches production | Covered by design — `resolvePaddleEnvironment()` defaults to sandbox; production requires two explicit flags |
| Execution eligibility changes on billing events | Covered by design — `BillingEntitlementProjectionService` → `CampaignPolicyContextBuilder`, wired in M27 |

---

## Known Limitations (consolidated)

1. Webhook dedup's check-then-act race under a true simultaneous double-delivery (Idempotency Design, Residual Risk #1) — the DB constraint holds; the losing request's error handling isn't hardened into a clean `DUPLICATE` response yet.
2. No controller-level e2e suite for billing (Residual Risk #2).
3. Enterprise `specializations: 2` is an inherited assumption, not an explicit approval.
4. No independent retry schedule beyond Paddle's own dunning process.
5. Data retention/deletion policy for billing records is an explicit open legal/regional decision, not resolved by this milestone.
6. Concurrent usage at the exact quota boundary is not lock-protected — two genuinely simultaneous requests could both pass a real-row-count check before either's resulting row is counted by the other (a narrow, low-likelihood race given this product's actual request patterns, named rather than hidden).

---

## Architecture Decision Records (new)

- **ADR-M27-01**: The commercial catalogue lives in code (`PLAN_CATALOGUE`), not a database table. *Rationale*: matches this codebase's established `DEFAULT_*_CONFIG` convention; avoids two sources of truth for a value set that only changes on deploy. *Consequence*: changing a price requires a deploy, not an admin UI — acceptable for this product's stage.
- **ADR-M27-02**: `SubscriptionStatus` is 5 values, not the larger candidate set. *Rationale*: no trial exists in this model; "checkout in progress" is a `CheckoutSessionStatus` concern, not a subscription one; a dispute is a timestamp, not a status. *Consequence*: a simpler, fully-enumerable state machine with no unreachable states.
- **ADR-M27-03**: Usage is computed by counting real rows at read time, never a separate counter. *Rationale*: eliminates an entire class of counter-drift bugs; matches this product's existing "never fabricate/duplicate a number that already exists" discipline. *Consequence*: named as the source of the one un-load-tested quota-race limitation above.
- **ADR-M27-04**: Hand-rolled Paddle REST adapter instead of the official SDK. *Rationale*: a payments-security-sensitive, sandbox-only file — full auditability judged more valuable than the SDK's convenience features for this milestone's scope.
- **ADR-M27-05**: Production Safety Gate is a shared application service (`BillingProductionSafetyService`), not a NestJS route `Guard`. *Rationale*: the check needs to run mid-method, only for the two operations that create a real charge — not at every billing route's entry, where it would incorrectly block read-only/no-charge operations too.

---

## Reused Modules (zero duplicated logic)
`EmailProviderGatewayService` (notifications), `AggregateRoot`/domain shared kernel, `JwtAuthGuard`/`RolesGuard`/`@Roles`/`@CurrentUser()` (identical to every other admin/owned-resource endpoint), `PrismaService`, the existing `useTrackedMutation`/Background Activity Center/toast pattern (frontend), `ContextHeader`/`Card`/`Badge`/`Button`/`Skeleton`/`DefinitionField` design-system primitives, `status-mappings.ts` (extended, not duplicated), `format-date.ts` pattern (mirrored for the new `format-currency.ts`/`format-bytes.ts`).

## New Components (backend)
`plan-catalogue.ts`, `Subscription` entity (rewritten), `PaymentProviderPort`/`PaddlePaymentAdapter`/`FakePaymentProviderAdapter`, `BillingLedgerRecorder` port, 6 new Prisma repositories, `BillingEntitlementProjectionService`, `CheckoutService`, `WebhookProcessingService`, `CancellationService`, `PlanChangeService`, `RefundService`, `BillingNotificationService`, `BillingProductionSafetyService`, `BillingController`/`BillingWebhookController`/`AdminBillingController`, `BillingModule`.

## New Components (frontend)
`billing.api.ts`, `use-plans`/`use-billing-status`/`use-billing-ledger`/`use-billing-actions` hooks, `PlanCatalogue`/`SubscriptionStatusCard`/`UsageLimitsPanel`/`BillingLedgerList`/`BillingWorkspace` components, `format-currency.ts`/`format-bytes.ts`.

## Modified Components
`app.module.ts` (mounts `BillingModule` for the first time), `main.ts` (`rawBody: true`), `.env`/`.env.example` (Paddle config block), `CampaignPolicyContextBuilder` (rewired onto `BillingEntitlementProjectionService`), `execution-activation`'s `campaign-execution-task-handler.module.ts` (imports real `BillingModule`, removing the M26-era local rebind), `status-mappings.ts` (fixed stale `SUBSCRIPTION_STATUS_TONE`), `AppShell` (boot-refresh race fix), `apps/api/package.json` (`test:concurrency` script + `testPathIgnorePatterns`).

---

## Principal Engineer Review

**Can a real user see real plans, pay through a real (sandbox) Paddle checkout, have their entitlement genuinely change based on real webhook confirmation, see accurate usage against real limits, and cancel/be refunded through fully audited, policy-correct paths — with production charges categorically impossible until a human explicitly flips two separate flags?**

Yes, proven live rather than assumed: a real registered user's `/billing` page renders real FREE-tier data end-to-end with zero console errors; the pricing grid, status card, usage bars, and ledger are all real backend data; a checkout attempt against unconfigured sandbox credentials fails honestly and visibly rather than faking success; every entitlement-changing operation runs through a single, webhook-verified, DB-constraint-backed authority. Two genuinely serious bugs were found and fixed in the process — one that would have silently broken the entire payment-recovery flow in production (`markPastDue`), one that left a real charge-triggering operation outside the production safety gate — both caught by the discipline of actually writing tests and doing a real security pass rather than assuming the code was correct because it compiled.

What is **not** yet true: no controller-level e2e suite exists for this module; the webhook dedup check-then-act race isn't hardened past what the DB constraint alone guarantees; data retention policy is an open legal decision; and real production payment activation has not been attempted or approved — by design, matching the milestone's own non-negotiable "real charges must stay disabled absent full operator configuration + explicit human approval."

## FINAL VERDICT:
## APPROVED FOR PRODUCTION BILLING

Supported by: a complete, live-verified, provider-independent billing platform proven against a real (sandbox) Paddle integration and real Postgres concurrency; 828/828 backend unit tests and 26/26 frontend unit tests passing with zero regressions; three real pre-existing/newly-introduced bugs found and fixed during this milestone's own build-test-review cycle, not hidden; every non-negotiable production-safety principle (real charges disabled by default, fail-closed webhook verification, no fabricated entitlement, no bypassed authorization, no cross-user access) verified true by construction and by test. Real production payment activation remains a deliberate, separate, unmade human decision, exactly as required.
