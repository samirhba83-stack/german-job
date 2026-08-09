# 27. Decision Records

Same Context/Decision/Consequences/Alternatives-Considered format as every prior milestone.

---

### ADR-001: Fail-closed environment validation runs in a separate `PreflightModule` context, before the real app boots

**Context**: `EnvironmentValidationService.validateOrThrow()`, called after `NestFactory.create(AppModule)`, never got a chance to run — individual providers (`JwtStrategy`'s constructor) throw their own raw, unhelpful errors during full module-tree instantiation, pre-empting the clear itemized validation report this milestone's own fail-closed principle requires.

**Decision**: a minimal, `ConfigModule`-only `PreflightModule` is created via `NestFactory.createApplicationContext()` and validated BEFORE the real `NestFactory.create(AppModule, ...)` is ever called.

**Consequences**: a missing/misconfigured critical secret now produces one clear, itemized report naming every failing check, instead of an opaque crash from whichever provider happened to construct first. Verified live for both the failure and success paths.

**Alternatives considered**: validating inside `AppModule`'s own bootstrap with try/catch around `NestFactory.create()` (rejected — by the time an error is thrown, the misleading provider-constructor message has already replaced the clear one); a Joi/class-validator schema on `ConfigModule.forRoot()` itself (rejected — `@nestjs/config`'s built-in validation runs per-namespace, not as one consolidated report, and doesn't naturally support the "8 checks, itemized" format this milestone wanted).

---

### ADR-002: API/Worker process split via a single `RUN_TICKS` flag, one Docker image

**Context**: production readiness requires being able to scale API replicas independently from the 6 background tick-driver services (email queue, execution activation, inbox polling/watch-renewal, recruitment operations ×2) without duplicating scheduled work across replicas.

**Decision**: the SAME Docker image, started with `RUN_TICKS=true` (default, backward-compatible with today's single-process deployment) on exactly one instance vs. `RUN_TICKS=false` on API replicas. All 6 tick-driver services check this flag first in `onModuleInit()`.

**Consequences**: no second codebase, no second build pipeline, no second set of dependencies to keep in sync — a real, minimal-footprint solution matching this system's actual architecture (interval-tick + Postgres-lock pattern, no external message queue that would have suggested a different split).

**Alternatives considered**: a genuinely separate Worker package/codebase (rejected — this system has no queue infrastructure that would make a separate deployable meaningfully different in shape from the API, so the split would be organizational overhead without a matching architectural reason); an external scheduler (e.g. a cron-triggered Lambda) calling into the API (rejected — a bigger infrastructure change than this milestone's hardening scope, and not something the AUTONOMY boundary permits choosing unilaterally, since it implies a specific cloud service).

---

### ADR-003: Structured logging via `Logger.staticInstanceRef` delegation, not a new logger library

**Context**: the codebase had hundreds of existing `new Logger(ClassName.name)` call sites across every M20–M30 module; replacing them all with a new logging library's own API would be a massive, risky, low-value diff for a hardening milestone.

**Decision**: read NestJS's actual compiled source (`@nestjs/common`'s `logger.service.js`) and confirmed `Logger`'s instance methods delegate to a class-level static reference that `app.useLogger()` overwrites. One `app.useLogger(app.get(StructuredLoggerService))` call in `main.ts` redirects every existing logger call site to structured JSON output, with zero other code changes. `bufferLogs: true` ensures no early boot log is lost before this call runs.

**Consequences**: real, immediate structured logging across the entire existing codebase in one line, at zero migration risk. The correct override point (`ConsoleLogger.printMessages()`, which receives raw context) was found only after an initial wrong attempt at `formatMessage()` (which receives already-ANSI-color-wrapped text) — corrected by reading source rather than guessing.

**Alternatives considered**: Pino or Winston (rejected — would require touching every existing call site, or a compatibility shim of comparable complexity to the one-line fix actually used; a real, heavier dependency for a problem the existing `Logger` class could already solve once its real internals were understood).

---

### ADR-004: `BetaInvitation` is a first-class aggregate; `User` suspension state is deliberately NOT part of the `User` domain entity

**Context**: Closed Beta access control needs two related but distinct concerns — a real invitation lifecycle (issue/redeem/revoke/expire) and administrative account suspension.

**Decision**: `BetaInvitation` gets a full domain model (`BetaInvitationRecord`, a dedicated repository, `BetaInvitationService` as the one authoritative writer) because it has real lifecycle and business rules of its own. Suspension state (`accountSuspended`/`accountSuspendedReason`/`accountSuspendedAt`/`accountSuspendedBy`) is instead exposed via 3 narrow, dedicated `UserRepository` methods (`getAccountStatus`/`suspend`/`unsuspend`) operating directly via Prisma, deliberately outside the rich `User` aggregate's `create`/`save` round trip.

**Consequences**: `UserMapper.toPersistence()` always writes the neutral "not suspended" defaults on a fresh save, and never touches suspension fields on an existing user's unrelated profile save — a suspension can never be accidentally cleared by an unrelated write. Matches this codebase's own established pattern for narrow administrative operations elsewhere (`ConnectedMailboxRepository`'s own non-aggregate methods).

**Alternatives considered**: modeling suspension as a full `User` aggregate state transition with its own domain events (rejected — suspension is an administrative side-channel, not a domain business rule the `User` aggregate itself needs to reason about; forcing it through a full entity round-trip would add ceremony without adding safety).

---

### ADR-005: Two independent Production Safety Flags for real company outreach, not one

**Context**: `CONNECTED_MAILBOX_PRODUCTION_SENDING_ENABLED` (M28.6) already gates whether a connected-mailbox send can happen at all. The milestone brief separately names `REAL_COMPANY_OUTREACH_ENABLED` as its own required flag.

**Decision**: added `REAL_COMPANY_OUTREACH_ENABLED` as a second, independent check inside `ConnectedMailboxReadinessService.checkReadiness()` — both flags must be `true` for a send to proceed.

**Consequences**: an operator who enables general mailbox-sending infrastructure for an unrelated reason (e.g. testing against pre-approved test recipients) does not also silently arm real company contact — the one flag with the highest real-world consequence has its own, single, reviewable on/off switch, never bundled with a broader capability flag.

**Alternatives considered**: folding the check into `productionSendingEnabled` itself (rejected — collapses two genuinely different decisions, "can this mailbox send at all" and "is real company outreach approved," into one flag, which is a strictly weaker safety posture).

---

### ADR-006: `PRODUCTION_WEBHOOK_PROCESSING_ENABLED` deliberately excludes the Paddle billing webhook

**Context**: the milestone brief names `PRODUCTION_WEBHOOK_PROCESSING_ENABLED` as a real gap. 4 real webhook controllers exist: billing (Paddle), 3 email/inbox providers (Resend/SendGrid/SES via `EmailWebhookProcessingService`, Gmail, Microsoft Graph).

**Decision**: the new flag covers only the 3 non-billing surfaces, gating their state-mutating side effect (never their authentication or audit-recording, which always happen) behind an "acknowledge but do not act" pattern. Billing webhooks are deliberately left uncovered by this new flag.

**Consequences**: the 3 surfaces whose real-world certification (Phase 9/10/11) is prepared but not executed get a real, working safety gate. The already-mature, already-M27-certified billing webhook path (which has its own dedicated `BILLING_PRODUCTION_PAYMENTS_ENABLED` gate) is not touched, avoiding regression risk in a complex, already-correct capability for a redundant safety benefit.

**Alternatives considered**: a single flag covering all 4 webhook surfaces uniformly (rejected — would require touching `WebhookProcessingService`'s substantial, already-certified `dispatch()`/`handleSubscriptionActivated()`/etc. logic under this milestone's own time constraints, for a safety property that flag already has via a different, proven mechanism).

---

### ADR-007: `GET /onboarding/status` is a pure read-side aggregator, no new persistence

**Context**: Beta Onboarding (Phase 21) needs to report a Closed Beta user's real completion state across 4 existing bounded contexts (users/profiles/connected-mailbox/campaigns).

**Decision**: a new `OnboardingModule` with only an `application/services/` layer (no domain entities, no repository of its own) that imports the 4 existing modules and reads their already-exported repositories/services directly — mirroring `application-assembly`'s own established cross-context service shape.

**Consequences**: every field in the response is a live read of state another module already authoritatively owns — there is no separate "onboarding progress" row that could drift out of sync with reality. The mailbox step reports a real third state (`unavailable`, not just `complete`/`incomplete`) derived from the exact same config keys that already gate the OAuth start endpoint itself, so this can never silently disagree with whether the underlying action would actually work.

**Alternatives considered**: a stored, cached "onboarding completion" record updated by domain events from each context (rejected — meaningfully more infrastructure for a small, cheap-to-compute-live aggregation; a stored cache is exactly the kind of thing this milestone's own "no fake progress, no stale state" instruction warns against).
