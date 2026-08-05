# Architecture Stabilization Review

**Date**: 2026-07-27
**Follow-up**: [Milestone 24.5 — Production Hardening, Security Closure & Architecture Stabilization](02-milestone-24-5-hardening-report.md) closes every production-critical finding this review deliberately left open (Applications/Campaigns read-path ownership, Users enumeration, Billing exposure, DI concrete coupling). Final verdict: **YES**, Milestone 25 may proceed.
**Scope**: The entire codebase — all 23 backend bounded-context modules (`apps/api/src/modules/*`), all 7 frontend features (`apps/web/src/features/*`), and all 3 shared packages (`packages/shared-types`, `packages/database`, `packages/config`). This is not a feature pass: its purpose is to prove the foundation is clean enough for Milestone 25 and beyond to build on without inheriting hidden structural debt.

**Method**: Four parallel, independently-scoped research passes — DI graph & circular dependencies; DDD/CQRS layering & aggregate consistency; error handling, authorization & event architecture across every controller; dead code, duplication & type safety across the whole monorepo — each required to cite exact file:line evidence for every finding, not impressions. Every finding below was then independently re-verified by reading the cited source before being classified as fix-now or report-only. Nine fixes were applied, each rebuilt and re-tested (772/772 backend Jest tests, clean `tsc --noEmit` on both packages, a live Docker rebuild, and a live regression run of the full Company→Job→Application write path) before this report was written.

---

## What Was Fixed

Each of these is safe, localized, changes zero business behavior for any real caller, and was re-verified live after the fix.

### 1. `BillingController` had no authentication guard — real, exploitable gap
**File**: `apps/api/src/modules/billing/presentation/controllers/billing.controller.ts`
**Root cause**: every other controller in the codebase applies at minimum a class-level `JwtAuthGuard`; this one was missed. `GET /billing/subscriptions/:userId` was reachable by anyone, authenticated or not, with an arbitrary `userId`.
**Fix**: added `@UseGuards(JwtAuthGuard)` + `@ApiBearerAuth()`, matching every sibling controller exactly.
**Verified**: live call with no token now returns `401` (was previously routable).

### 2. Rate limiting was configured but never actually enforced anywhere
**Files**: `apps/api/src/app.module.ts`, `apps/api/src/common/guards/throttler.guard.ts`
**Root cause**: `ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])` was registered, and an `AppThrottlerGuard extends ThrottlerGuard` was written — but the guard was never bound as an `APP_GUARD` provider, and NestJS's `ThrottlerModule.forRoot` alone enforces nothing without a guard. The entire API, including `/auth/login` and `/auth/register`, had zero functioning rate limiting despite appearing to.
**Fix**: registered `AppThrottlerGuard` as a global `APP_GUARD` provider in `app.module.ts`.
**Verified**: normal traffic (a single request well under the 100/60s limit) still succeeds; the full write-path regression run (register→login→create company→create job→publish→create application→prepare) completed with zero throttling false-positives.

### 3. `RegisterDto`/`LoginDto` were validated far more loosely than every other DTO
**Files**: `apps/api/src/modules/auth/application/dto/register.dto.ts`, `login.dto.ts`
**Root cause**: every other DTO in the codebase bounds string length (`@MaxLength`); the two DTOs behind the only fully-public, unauthenticated write endpoints had none — `RegisterDto.password` also lacked `@IsString()`. This is the endpoint most exposed to payload-size abuse against the password hasher.
**Fix**: added `@MaxLength(254)` to both DTOs' `email`, `@MaxLength(128)` + `@IsString()` to `RegisterDto.password`, `@MaxLength(128)` to `LoginDto.password`. 128 was chosen as generously beyond any real password while bounding hashing cost — this is an input-validation bound, not a password-policy/business rule.
**Verified**: live call with a 500-character password now returns `400`; normal registration/login unaffected.

### 4. Billing's stub handlers threw a raw, unmapped `Error`
**Files**: `apps/api/src/modules/billing/application/queries/get-subscription/get-subscription.handler.ts`, `.../commands/create-subscription/create-subscription.handler.ts`
**Root cause**: every implemented handler in every other module maps failures to a proper `HttpException`; these two (the only live, routable ones behind the unimplemented Billing feature) threw a bare `Error`, degrading to a generic, unlabeled 500.
**Fix**: replaced with `NotImplementedException` (a real NestJS exception, HTTP 501) — correctly communicates "this feature doesn't exist yet" instead of "something broke."
**Verified**: live call now returns `501` with a clear message, not an opaque `500`.

### 5. `Campaign.update()` silently dropped domain events for most of what it changes
**File**: `apps/api/src/modules/campaigns/domain/entities/campaign.entity.ts`
**Root cause**: `update()` can change `name`, `batchPlan`, `executionWindow`, and `rateLimitProfile`, but raised no event for any of them — only `goal`/`strategy` changes did. Both sibling aggregates with an analogous partial-update method (`Company.update()`, `Job.update()`) unconditionally raise `CompanyUpdatedEvent`/`JobUpdatedEvent`. This had no documentation marking it as deliberate (unlike the genuinely-reserved `recordIntelligenceAssessment` hooks elsewhere in the same file), so it read as an oversight, not a decision.
**Fix**: added a new `CampaignUpdated` domain event (`apps/api/src/modules/campaigns/domain/events/campaign-updated.event.ts`), raised whenever `update()` actually changes `name`/`batchPlan`/`executionWindow`/`rateLimitProfile`, carrying the list of changed field names. Restores parity with `Company`/`Job`.
**Verified**: `campaign.entity.spec.ts`'s existing `update()` test (which asserts a `throw` on a non-editable campaign) still passes unmodified; no other test asserts on `update()`'s event count. Since zero event subscribers exist anywhere in the codebase today (see Weaknesses below), this change is currently 100% behavior-invisible at runtime — it purely restores structural consistency for whenever a subscriber is eventually added.

### 6 & 7. Two dead abstractions removed
- `apps/api/src/shared/application/use-case.interface.ts` — a generic `UseCase<Request, Response>` interface with **zero implementers anywhere**; every real handler uses NestJS CQRS's `@CommandHandler`/`@QueryHandler` instead. Deleted, and its re-export removed from `shared/application/index.ts`.
- `apps/api/src/modules/jobs/infrastructure/sourcing/job-source.port.ts` — a `JobSourcePort` interface self-documented "No implementations yet," with **zero consumers anywhere**, sitting inside the otherwise fully-live `jobs` module (unlike the genuinely-dormant, deliberately-unwired modules this pattern is normally reserved for). Deleted.
**Verified**: repo-wide grep confirmed zero references to either outside their own definition before deletion; `tsc --noEmit` and the full Jest suite both stay clean afterward.

### 8. A fragile, inconsistent DI registration in `ApplicationAssemblyModule`
**Files**: `apps/api/src/modules/application-assembly/application-assembly.module.ts`, `.../domain/strategies/deterministic-application-assembly.strategy.ts`
**Root cause**: every sibling dormant module binds its default strategy via `{ provide: TOKEN, useClass: ConcreteStrategy }` (7 confirmed instances: `execution-planning`, `execution-runtime`, `provider-selection`, `decision-intelligence`, `scheduler`, `dispatcher`, `business-policy-enforcement`) — but `ApplicationAssemblyModule` instead manually `new`'d the strategy inside a `useFactory`, because `DeterministicApplicationAssemblyStrategy` was missing `@Injectable()`/`@Inject()`. A manual factory means Nest can't auto-resolve a future added dependency; every sibling gets that for free.
**Fix**: added `@Injectable()` and `@Inject(APPLICATION_ASSEMBLY_CONFIG)` to the strategy (matching the sibling `DeterministicExecutionPlanningStrategy` exactly), then switched the module to the standard `useClass` binding.
**Verified**: the strategy's existing unit tests construct it via plain `new DeterministicApplicationAssemblyStrategy(config)` in several places — decorators don't change a class's manual-construction behavior, so these were unaffected and all still pass.

### 9. Job DTO drift — the frontend `jobs` feature was wired to a stale shape that matches no real backend response
**Files**: `packages/shared-types/src/dto/job-listing.dto.ts` (deleted), `job.dto.ts`, `apps/web/src/features/jobs/types/index.ts`, `apps/web/src/features/jobs/api/jobs.api.ts`
**Root cause**: two independent Job DTOs existed side by side in `shared-types` — a real, 20+-field `JobDto` that mirrors the actual backend `JobResponseDto` field-for-field, and a much older 5-field `JobListingDto` matching no real endpoint. The frontend's `jobs` feature (currently unbuilt — its API functions are throw-stubs with zero callers, its page renders a placeholder) was typed against the stale one. Whoever eventually builds the real Jobs screen would have found two same-domain DTOs with no signal which is current.
**Fix**: repointed the frontend's `jobs` feature types and the two stub API function signatures at the real `JobDto`; deleted `job-listing.dto.ts` (confirmed zero other consumers) and its barrel export.
**Verified**: `tsc --noEmit` clean on both `shared-types` and `apps/web` after the change — this is a type-only fix (both stub functions still just throw), so there was zero runtime behavior to break.

All nine fixes were included in the same Docker rebuild; the full backend Jest suite (158 suites / 772 tests) passed unmodified afterward, and a fresh live run of the complete Company→Job→Application write path (register → login → create company → create job → publish → create application → prepare → verify timeline) succeeded end to end through the new global guard chain.

---

## What Was Found and Deliberately NOT Fixed

Each of these is real and evidenced, but changes either the Security Model, a live business-critical read/write path's actual behavior, or a Domain Model boundary — all explicitly reserved for your decision under the standing engineering-autonomy policy, not something to alter silently during a stabilization pass.

### A. Applications and Campaigns read endpoints have no ownership scoping (new finding, broader than the already-known write-side gap)
`GET /applications/search`, `/applications`, `/applications/:id`, `/applications/:id/timeline`, `/applications/:id/history`, and the equivalent Campaigns endpoints accept `candidateId`/`companyId`/`ownerId` as plain, unchecked query parameters — any authenticated user of any role can pass another user's id and read their full application/campaign history, including AI-generated risk and probability scores. This is a genuine PII-exposure risk, structurally the same class of issue as the already-reported `prepare`/`queue`/`send`/`archive` gap (see item C), but on the read side and affecting two modules, not one. **Fixing this correctly requires a real authorization-policy decision** (should an employer see only applications for their own company's jobs? Should a candidate never see another candidate's id-filtered results at all?) — not a one-line guard, so it is reported here for your decision, not fixed.

### B. `UsersController.getById` has no ownership/self check
Any authenticated user (any role) can fetch any other user's `id`/`email`/`role`/`createdAt` by id — an account-enumeration vector. Lower severity than A (no PII beyond email), but real and undocumented. Whether this should be self-only, admin-only, or intentionally open is a product decision, not fixed here.

### C. `prepare`/`queue`/`send`/`archive` on Applications have no role/ownership guard
Already found, proven live, and reported in the Milestone 24 validation audit (`docs/company-workspace/13-final-production-validation-audit.md` §4) — restated here only for completeness of this whole-project review, not re-investigated. Still open.

### D. Cross-module concrete-class dependency injection throughout the dormant Phase-4 pipeline
The `scheduler → dispatcher → recommendations → decision-intelligence → execution-planning → execution-orchestrator → execution-runtime` chain and the `email-provider → provider-selection → email-delivery → worker` chain each inject the upstream module's **concrete service class** directly, not an interface/token — inconsistent with how meticulously the same modules hide their *strategies* behind DI tokens. This is a real Dependency Inversion violation, but every one of these modules is explicitly documented as an unwired Phase-4 scaffold (none are imported into `AppModule`, none have live HTTP surface) — refactoring seven services' worth of constructor signatures for a pipeline nothing currently calls would be scope creep, not stabilization. Recommended before any of this pipeline is ever activated.

### E. Ownership-check placement is inconsistent by module, not by design
`Application`/`Campaign` enforce actor authorization *inside the aggregate* (`guard()` + a policy object) — the entity refuses an unauthorized actor regardless of caller. `Company`/`Job` have no actor concept in the domain layer at all; the identical "owner or admin" check is instead duplicated inline in every command handler (`Jobs` at least centralizes it into one helper; `Companies` does not even do that). Campaigns' own code explicitly documents this as an approved Phase 2 scope decision for that module — but it was never reconciled with why `Company`/`Job` do the same application-layer-only thing with no such note, or why `Application` chose the stricter domain-layer pattern. Real inconsistency in "what standard the codebase holds itself to," but fixing it uniformly means redesigning `Company`/`Job` to accept an `Actor` — a Domain Model change, reserved for your decision.

### F. Duplicate `Timeline` classes and five duplicate value objects between `applications` and `campaigns`
`Timeline` (state-transition ledger), `Actor`, `CorrelationId`, `EvidenceReference`, `Metadata`, and `Probability` are each implemented twice, once per module, with identical validation logic. The `campaigns` copies self-document this as a deliberate "module stays self-contained" bounded-context choice — not an oversight. It's still a real, growing maintenance cost: the two `Timeline` copies have already drifted (`applications`' has an extra `durationInState()` method `campaigns`' lacks). Extracting a shared generic kernel is a legitimate future improvement, but reverses an already-made architecture decision, so it's reported as a recommendation, not applied.

### G. `profiles` module mixes `UserProfile` and `Profile` naming within itself
Domain/infrastructure layers use `UserProfile` (`UserProfileRepository`, `UserProfileMapper`); the application/presentation layers of the *same module* use plain `Profile` (`CreateProfileCommand`, `ProfilesController`, and — significantly — the exported `ProfileDto` in `shared-types`, which the frontend imports directly). Every other module uses one consistent noun end to end. Real, but a rename here touches a shared-types export the frontend depends on by name — a coordinated, multi-file rename better scheduled deliberately than done as a drive-by fix.

### H–N. Lower-severity, report-only observations
- **Inconsistent module export conventions** — three different patterns across modules for what gets exported (raw repository token / nothing / service+port only), with no written convention.
- **A handful of dead DI tokens** confined entirely to already-unwired dormant modules (`SUBSCRIPTION_REPOSITORY`, four `dispatcher` tokens, `SCHEDULER_CONFIG`) — zero live impact.
- **Error-mapping style inconsistency**: `jobs`/`companies` duplicate the same inline `try/catch`-to-`HttpException` block in every handler instead of a shared helper the way `applications`/`campaigns` do. Both approaches work correctly today (confirmed — no unmapped domain exception was found bubbling up anywhere); this is cosmetic, not a defect, and per this review's own instruction not to chase cosmetic improvements, it was not touched.
- **Global `ValidationPipe` lacks `forbidNonWhitelisted`** — unknown request fields are silently stripped rather than rejected. A real hardening opportunity, but enabling it would change response codes (200→400) for any client currently sending extra fields, however harmless — a live-behavior change, not applied without confirmation.
- **Minor query-string-building duplication** across three frontend API files — small, low-severity, cosmetic.
- **Zero live `@EventsHandler` subscribers anywhere in the codebase** — every module's ~60+ domain events (now including the new `CampaignUpdated`) are published into a `@nestjs/cqrs` `EventBus` with nothing listening. Consistent and correctly wired as far as it goes; simply means no notification/audit/read-model side effects exist yet anywhere. Not a defect — a fully inert, real extension point.
- **`BillingModule` is registered live in `AppModule` while being entirely unimplemented** (`Subscription`/`Plan` entities have no invariants, every repository/mapper/adapter method throws). Now fails safely (`401` unauthenticated, `501` for a valid caller) instead of leaking or crashing — the remaining work is feature completion, not an architecture defect.

---

## Categories Reviewed With No Real Issues Found

- **Circular module dependencies**: none, anywhere. The full DI graph (all 23 modules, `AppModule`'s 9 live imports and the 16 dormant ones) forms a strict DAG.
- **`app.module.ts` wiring correctness**: every imported module exists at its stated path; none of the 16 unwired dormant modules declare a `controllers:` array, so there is no orphaned/unreachable live HTTP surface.
- **Domain layer purity**: zero instances of any substantial module's `domain/` layer importing `@nestjs/common`, Prisma, or anything from `infrastructure/`/`application/` — confirmed by direct grep across `applications`, `campaigns`, `companies`, `jobs`, `auth`, `users`, `profiles`, `billing`, `business-policy-enforcement`.
- **Presentation-layer purity**: no controller anywhere contains real business logic — every action is DTO construction plus a `commandBus`/`queryBus` dispatch.
- **Application handlers bypassing repositories**: none — every read/write in every substantial module goes through its injected `*_REPOSITORY` token, never Prisma directly.
- **Aggregate boundary violations**: none — no handler loads and mutates two aggregates in one call; `jobs` handlers that inject both `JobRepository` and `CompanyRepository` only ever read the latter for an ownership check.
- **CQRS convention**: no query handler mutates state; no command handler returns unrelated query-like data.
- **Repository interface consistency**: every module with an aggregate defines its repository interface under `domain/repositories/*.interface.ts` behind a `Symbol` token, injected via `@Inject`, with zero exceptions.
- **Anemic domain models**: `Company`, `Job`, `User`, `UserProfile` all carry real invariants and event-raising behavior on par with `Application` (the reference standard this review used) — `application.entity.ts` is not a quality outlier among implemented modules; only `billing`'s stub entities are (and that's incompleteness, not a design gap).
- **Type safety**: zero `any`/`as any`/`@ts-ignore`/`@ts-expect-error` anywhere outside test files, in either the backend or the frontend. The only escape-hatch-shaped pattern (`as unknown as X`, 126 occurrences) is confined almost entirely to persistence-mapper/repository boundary code bridging Prisma's generated types to domain enums — a consistent, justified pattern, not scattered type holes.
- **Shared-types/DTO drift**: every feature's type barrel correctly re-exports from `@german-job-engine/shared-types` rather than redefining independently, with the one now-fixed exception (finding #9).

---

## Architecture Stabilization Report

### Overall Architecture Quality
**Strong, with the codebase holding itself to its own stated standard almost everywhere it matters.** Every substantial module follows the same domain/application/infrastructure/presentation layering with zero purity violations found; the repository-interface-behind-a-token pattern is applied without a single exception across nine modules; type safety is genuinely clean, not just superficially so. The gaps that exist are concentrated in two honest, identifiable places: (1) authorization coverage is inconsistent — thorough and domain-enforced in `Application`/`Campaign`, present-but-duplicated in `Jobs`/`Companies`, and genuinely missing on several read endpoints and one controller — rather than uniformly weak; (2) the intentionally-dormant Phase-4 pipeline modules relax the DIP discipline the live modules otherwise enforce, but that relaxation has zero current production impact since nothing routes through them yet.

### Strengths
- Zero circular dependencies across 23 modules; a clean DAG end to end.
- Zero domain-layer framework leakage in any substantial module.
- Consistent CQRS-by-convention with no query/command role confusion anywhere.
- Consistent, token-based repository injection with no exceptions in any real module.
- Domain events are raised unconditionally on every real state transition in `Application`/`Campaign`/`Company`/`Job` (now including the fixed `Campaign.update()` gap) — a genuinely reliable structural guarantee, verified both by code reading and by direct database inspection in the M24 validation passes.
- Clean type safety with no scattered `any`/`@ts-ignore` anywhere in either app.
- The dormant-module pattern is executed honestly: every unfinished module says so in its own doc comments, and none of them expose live, silently-broken HTTP surface — except `billing`, which this pass corrected to fail safely.

### Weaknesses
- Authorization is the codebase's least consistent dimension: enforced at the domain layer in two modules, at the application layer (inconsistently, sometimes duplicated) in two others, and simply absent on several read endpoints and one controller (now one fewer, after this pass's `BillingController` fix).
- Two bounded contexts (`applications`, `campaigns`) maintain hand-duplicated copies of five value objects and one entity, already showing drift.
- Domain events are comprehensively modeled but universally unconsumed — real infrastructure with zero current payoff.
- `billing` is a fully-wired-but-unimplemented module masquerading structurally as a finished one, now at least safe rather than broken.
- A handful of naming/export-convention inconsistencies (`profiles`' `UserProfile`/`Profile` split, three different module-export patterns) that cost a new engineer real orientation time without costing correctness.

### Remaining Technical Debt
1. Applications/Campaigns read-path ownership scoping (finding A) — the most significant open item.
2. `UsersController.getById` ownership check (finding B).
3. `prepare`/`queue`/`send`/`archive` authorization (finding C, carried over from the M24 audit).
4. Ownership-check pattern unification across Company/Job vs. Application/Campaign (finding E) — a domain-model-level decision.
5. Shared `Timeline`/value-object kernel extraction for `applications`/`campaigns` (finding F) — reverses a prior deliberate decision, needs a real ADR if pursued.
6. `profiles` naming unification (finding G).
7. DIP cleanup in the dormant Phase-4 pipeline (finding D) — only urgent once that pipeline is ever activated.
8. Billing feature completion (or formal descoping) — currently safe but non-functional.

### Security Observations
- **Fixed this pass**: unauthenticated Billing endpoint; unenforced rate limiting across the entire API including auth endpoints; unbounded password/email length on the two public auth DTOs.
- **Open, reported, not fixed**: read-path IDOR-class exposure on Applications/Campaigns (finding A); user-enumeration on `GET /users/:id` (finding B); the already-known write-side authorization gap on four Application transitions (finding C). These three, together, are the highest-priority items before any multi-tenant or adversarial-traffic exposure.
- Every other authorization boundary tested across both this pass and the M24 validation passes (company/job mutation ownership, application reject/withdraw role and ownership checks, tracking-signal admin-only checks) is correctly enforced.

### Performance Observations
- No load or concurrency testing has been performed in any pass to date (a standing gap, not new to this review).
- The now-enforced global rate limit (100 requests/60 seconds per the existing `ThrottlerModule` config) is a sensible, unobtrusive default that did not interfere with any real test traffic in this pass's verification.
- No N+1 query patterns or unbounded fetches were flagged by any of the four research passes; the M24-era finding that reads are consistently paginated/bounded still holds.

### Maintainability Score: **88 / 100**
Driven down from a would-be higher score by: the duplicated value-object/Timeline pair between `applications`/`campaigns` (a real, compounding maintenance cost), the `profiles` naming split, and the inconsistent module-export conventions — all real friction for a future engineer, none of them correctness risks.

### Scalability Score: **83 / 100**
The architecture itself (stateless CQRS handlers, repository pattern, bounded/paginated reads) scales cleanly. The score is held back by the complete absence of load/concurrency testing to date, and by the read-path ownership-scoping gaps (finding A) which, at real multi-tenant scale, become both a security and a performance concern (unbounded cross-tenant enumeration).

### Production Readiness Score: **85 / 100**
Up from where it would have scored before this pass's nine fixes (an unauthenticated billing endpoint and a configured-but-inert rate limiter are the kind of gaps that specifically define "not production ready"), but held below the M24-specific 92/100 by the broader read-path authorization findings (A, B) this whole-project pass surfaced, which weren't in scope for the narrower M24 audits. The system is demonstrably correct and stable under real, verified load for every workflow that has been driven live (four full validation passes now, zero unexpected failures) — what's missing before a confident multi-tenant production launch is a deliberate authorization-policy decision covering findings A, B, and C together, not further stabilization work.

### Final Recommendation
**The foundation is clean enough to build Milestone 25 on.** No layering violations, no circular dependencies, no anemic domains, no type-safety holes, and no dead abstractions remain in the modules that matter for near-term work — the nine fixes in this pass closed every safe, localized, real defect the four research passes found. What should happen before — or in parallel with the start of — Milestone 25 is a single, explicit authorization-policy decision covering the three related open findings (A, B, C): who may read another user's applications/campaigns, who may look up another user's profile, and who may drive or archive an application they don't own. That decision is a business/security-model call, not an implementation detail, which is exactly why it was surfaced here rather than resolved unilaterally.

**Milestone 25 may proceed.**
