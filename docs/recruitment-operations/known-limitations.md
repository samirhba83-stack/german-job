# Known Limitations — Recruitment Workflow Orchestration

Every item below is a deliberate scope boundary confirmed against real, investigated backend
constraints — not a guess made against a live production execution path. Each names the real
constraint that forced the decision.

## 1. "Follow-up suppression" means preventing re-selection, not cancelling a queued send

The brief's Phase 5/6 language ("queued follow-up cancellation," "final pre-send checkpoint")
assumes a persisted queue/reservation stage for campaign targets, the way `EmailMessage` has one
(M28). Investigated before building anything: this codebase's real campaign engine has no such
stage. `Campaign.planNextBatch()` selects PENDING targets and marks them QUEUED; the very same
synchronous call to `CampaignBatchDispatchService.dispatchOneTarget()` then resolves/creates the
real `Application` and sends — there is no separate persisted "reservation" a later process could
race against or cancel. `CampaignEligibilityPolicy` also only ever selects PENDING targets — once
DISPATCHED, a target is never re-selected by anything. There is structurally no retry/re-contact
mechanism to interrupt.

Given this, "follow-up suppression" is honestly implemented as **preventing re-selection of an
already-corresponding-with application in a future batch or campaign** — enforced by the one real,
always-executed checkpoint: `FollowUpEligibilityService.checkEligibility()`, called immediately
after `findOrCreateApplication()` resolves the real applicationId and immediately before the real
provider send inside `dispatchOneTarget()`. This is honestly both "queue insertion" and "final
pre-send recheck" collapsed into a single checkpoint, not a shortcut — every real target that could
ever be dispatched passes through it unconditionally (once `REPLY_DRIVEN_EXECUTION_ENABLED=true`).

## 2. `OFFER_RECEIVED` still never dispatches the real Applications-side transition (inherited from M29, unchanged)

`RecordExternalOfferEvidenceCommand` (M30, additive) is dispatched when an offer proposal is
confirmed — it records real evidence via `ApplicationOperationalDecision`, but the real
`Application.status` never moves to `OFFER_RECEIVED` through this pipeline. `OfferPolicy` requires
a genuine `ActorRole.COMPANY` actor, a pre-existing domain rule this milestone does not weaken or
bypass by fabricating a `COMPANY` actor for a system-detected reply. A real company-side
confirmation flow remains a separate, future decision.

## 3. Mission Control's reply/follow-up projection is a documented exception to the module's own rule

`ReplyFollowUpProjectionService` (M30) queries inbox-intelligence/recruitment-operations data
directly — the module's pre-existing doc comment says every projection sources from
`ExecutionEventQueryService` only. Reply/follow-up/task data has no `ExecutionEvent` equivalent, so
this is a real, necessary, and now-documented exception rather than a silent violation. Mission
Control itself remains dormant (not mounted in `AppModule`, no controller) — this milestone adds
real groundwork, not a newly-live surface.

## 4. `FollowUpResumeService` does not re-verify campaign/mailbox/deliverability state itself

`processExpiredHolds()` only ever (a) closes out a genuinely expired hold, or (b) supersedes with a
`PERMANENT_SUPPRESSION` if the application reached a terminal/high-impact status through some other
path while the hold was counting down. It deliberately does NOT re-check business-policy
enforcement, connected-mailbox readiness, subscription entitlement, or deliverability suppression —
those real checks already run, unconditionally, on every real dispatch attempt inside
`CampaignBatchDispatchService.dispatchOneTarget()`. Duplicating them here would only risk drift from
the real source of truth. "Resumed" only ever means "no longer follow-up-blocked" — never
"guaranteed to send."

## 5. The eligibility evaluator resolves expiry in real time; the resume tick only closes out the historical row

`evaluateFollowUpEligibility()` checks `expiresAt <= now` directly — an expired-but-still-`ACTIVE`
row in the database is already treated as `ELIGIBLE` (`reasonCode: HOLD_EXPIRED`) before the
periodic tick ever runs. This is intentional (Phase 4's "the final pre-send recheck is mandatory" —
no eventual-consistency gap where a legitimate resume attempt could be wrongly blocked between real
expiry and the next tick), proven by this milestone's own E2E test. The tick's real job is narrower
than "make it eligible": it is the one place that actually writes `EXPIRED` to the row for a correct
historical record, and the one place that checks whether the application moved on to a
terminal/high-impact status while the hold was active (see #4).

## 6. Two legacy (M19/M26) e2e test files cannot be run against a partial module graph — not a production risk

`test/execution-pipeline.e2e-spec.ts` and `test/execution-resilience.e2e-spec.ts` hand-assemble a
*partial* NestJS testing module (`[PrismaModule, ExecutionOrchestratorModule, ExecutionRuntimeModule,
WorkerModule, ExecutionTrackingModule]`) rather than bootstrapping the real `AppModule` (the pattern
every other e2e spec in this repo uses, including this milestone's own
`test/m30-reply-to-execution.e2e-spec.ts`). Running the full e2e suite for this milestone's own
verification surfaced that `WorkerModule → CampaignExecutionTaskHandlerModule`'s import graph has
grown, across M26–M30, to include most of the application — and several modules along that path
(`DocumentsModule`, `EmailProviderModule`, `BillingModule`, `ConnectedMailboxModule`,
`DeliverabilityModule`, and this milestone's own `RecruitmentOperationsModule`) inject `ConfigService`
directly without importing `ConfigModule` themselves, silently relying on `AppModule`'s
`ConfigModule.forRoot({ isGlobal: true })`. That's invisible in the real running app (global modules
are available everywhere) but breaks the moment one of these modules is compiled inside a narrower
graph that never registers `ConfigModule` at all.

**Fixed this milestone:** all 6 `ConfigModule` gaps above — real, defensible, low-risk fixes (each
module is now correctly self-contained), verified via `tsc`/`eslint`/`nest build`/the full unit
suite/a fresh live boot, all clean.

**Deliberately NOT fixed:** `EmailQueueWorkerService` (`DeliverabilityModule`) and
`RecruitmentOperationsTickDriverService` (`RecruitmentOperationsModule`) also inject
`SchedulerRegistry` (`@nestjs/schedule`) for their own `@Cron` ticks. Unlike `ConfigModule`,
`SchedulerRegistry` is only ever provided via `ScheduleModule.forRoot()` — and `.forRoot()` is
correctly called exactly once, in `AppModule`. Calling it again in a feature module would risk
duplicate cron-job registration the moment that module is loaded alongside `AppModule`'s own
registration in the real app (which it always is). The safer, correct fix — refactoring these two
legacy test files to bootstrap the real `AppModule`, matching every other e2e spec — is a real,
proportionate follow-up recommendation, but is scoped outside this milestone (the two affected
files are pre-existing M19/M26 test infrastructure, not M30 deliverables).

**Why this is not a production risk:** the real `AppModule` boots cleanly with zero DI errors,
verified repeatedly, live, with a fresh `node dist/main.js` process throughout this milestone's own
work — including immediately after every fix above. The 3 real, production-shaped e2e suites
(`app.e2e-spec.ts`, `execution-activation.e2e-spec.ts`, and this milestone's own
`m30-reply-to-execution.e2e-spec.ts`) all pass. The full unit suite (196 suites / 1282 tests) and
the full concurrency suite (9 suites / 27 tests) both pass with zero regressions.

## 7. No dedicated concurrency test for the queued-follow-up-cancellation race

Per #1, no such queue exists to race against — the eligibility gate is a single, synchronous,
always-executed check inside the real dispatch call, not a separate stage a concurrent cancellation
could race. The two concurrency invariants this milestone's design genuinely depends on
(`ApplicationFollowUpControl` one-active-per-application, `ApplicationTransitionProposal`
exactly-once transition) are both proven under real Postgres concurrency — see
[threat-model.md](./threat-model.md).
