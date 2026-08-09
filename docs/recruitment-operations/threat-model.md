# Threat Model & Security Review — Recruitment Workflow Orchestration

Real findings from this milestone's own review pass, each verified live (not just reasoned about)
before being marked resolved. Every bug below was self-caught during this milestone's own build and
verification work, not reported by a user.

## Findings — 5 real bugs found and fixed this pass

### 1. Admin compliance-hold recorded the wrong owner (critical, self-caught)

**The bug:** `AdminRecruitmentOperationsController.applyComplianceHold()` set the created
`ApplicationFollowUpControl`'s `userId` to the acting admin's own id (`admin.sub`) instead of the
real candidate's id (`application.candidateId`). Every ownership check in this milestone
(`FollowUpControlService.release()`, `RecruitmentOperationsController`'s own lookups,
`listByUserId()`) keys off `userId` — recording the admin's id would have made the control
permanently invisible to and inaccessible by the very candidate it was meant to apply to.

**The fix:** injected `ApplicationRepository`, looked up the real application, and used
`application.candidateId` as the control's owner. The acting admin is recorded separately in the
audit trail (`FOLLOW_UP_CONTROL_CREATED`, `detail: "Admin {id} applied a compliance hold: ..."`).

### 2. Admin release bypassed the ACTIVE-status guard (real, self-caught)

**The bug:** `FollowUpControlRepository.release()` unconditionally sets `status: 'RELEASED'`
regardless of a row's current status. The candidate-facing path
(`FollowUpControlService.release()`) correctly guards this with `control.status !== 'ACTIVE'` →
`ForbiddenException` — but `AdminRecruitmentOperationsController.releaseControl()` called the
repository directly, bypassing that guard entirely. An admin could "release" an already-RELEASED,
EXPIRED, or SUPERSEDED control: this silently rewrites a historical record (a SUPERSEDED row would
falsely start showing `releasedAt`/`releasedBy`, misrepresenting *why* the hold ended), and, worse,
if the admin targeted an old SUPERSEDED row while a newer control was the real active suppression,
the admin would believe they'd unblocked the application while the real active hold stayed
untouched.

**The fix:** added `FollowUpControlService.releaseAsAdmin()` — the same `status !== 'ACTIVE'` guard
as `release()`, but (deliberately, unlike `release()`) without the `USER_RELEASABLE_TYPES`
restriction, since an admin may release a `DELIVERABILITY_BLOCK` that a candidate may not (Phase
16: "no user may manually release a compliance or security suppression"). The controller now calls
this method instead of touching the repository directly.

### 3. `ApplicationTransitionProposal` confirm/reject was a TOCTOU race, not exactly-once (real, self-caught)

**The bug:** `confirmProposal()`/`rejectProposal()` checked `proposal.status === 'PENDING'` via a
plain read (`requireOwnedPendingProposal()`), then wrote via an unconditional
`update({ where: { id } })`. Two concurrent confirm calls for the same proposal (a double-click, a
retried network request) could both pass the read-check before either write landed, both proceed to
dispatch the underlying domain command — a real violation of the brief's own explicit "exactly-once
execution" requirement (Phase 7).

**The fix:** replaced the unconditional update with `ApplicationTransitionProposalRepository
.tryTransition()` — the same conditional `updateMany({ where: { id, status: fromStatus } })` +
affected-row-count idiom this codebase already uses for `EmailMessage` queue claims
(`PrismaEmailQueueRepository.claimBatch()`). `confirmProposal()` now atomically claims
`PENDING → CONFIRMED` *before* dispatching; only the caller whose conditional update actually
matches a row proceeds — every other concurrent caller gets a real 409, never a second dispatch. On
a real domain-guard rejection (the application moved on), the already-claimed row transitions to
`REJECTED` (stale). On a genuinely unexpected failure, the claim releases back to `PENDING` so the
proposal stays real and retryable, never stuck showing `CONFIRMED` for a command that didn't
actually succeed.

**Proven under real concurrency:**
`application-transition-proposal-exactly-once.concurrency.spec.ts` — 4 tests: concurrent confirms
on the same proposal (exactly 1 wins), a confirm racing a reject (exactly 1 side wins, never both),
a second confirm after the first succeeds (gets `null`, no second claim), and the unexpected-failure
rollback-then-retry path. All pass against a live Postgres instance.

### 4. `ApplicationTransitionProposal` had no ownership check at all (critical, pre-existing from M29, self-caught)

**The bug:** any authenticated user could confirm or reject any other user's transition proposal —
`ApplicationTransitionProposal` carries no `userId` of its own, and the M29 controller captured
`@CurrentUser()` but never compared it against the underlying application's owner.

**The fix:** `requireOwnedPendingProposal()` — looks up the real `Application`, compares
`application.candidateId === userId`, returns the identical `NotFoundException` shape whether the
proposal doesn't exist or belongs to someone else (same anti-enumeration discipline as
`InboxIntelligenceController.requireOwnedMessage()`). Live-verified:
`POST /inbox/transition-proposals/{random-uuid}/confirm` with no matching owned proposal → 404.

### 5. Six modules silently depended on `AppModule`'s global `ConfigModule` registration (real, pre-existing since M28, self-caught)

**The bug:** `DocumentsModule`, `EmailProviderModule`, `BillingModule`, `ConnectedMailboxModule`,
`DeliverabilityModule` (all pre-existing), and this milestone's own `RecruitmentOperationsModule`
each have providers injecting `ConfigService` directly without importing `ConfigModule`
themselves — invisible in the real app (where `ConfigModule.forRoot({ isGlobal: true })` is
registered once in `AppModule`), but a real `UnknownDependenciesException` the moment any of them
is compiled inside a narrower module graph. Surfaced by this milestone's own M30 module-wiring
changes pulling a much larger swath of the app into one pre-existing narrow legacy test's reach —
see [known-limitations.md](./known-limitations.md) #6 for the full account, including the one
related class of gap (`SchedulerRegistry`/`ScheduleModule`) found but deliberately NOT fixed the
same way, because doing so would itself introduce real production risk.

**The fix:** each of the 6 modules now explicitly imports `ConfigModule` — safe and idempotent
even where it's also global (NestJS treats it as the same singleton either way), and makes each
module correctly self-contained rather than silently dependent on what else happens to be compiled
alongside it.

## Reviewed and confirmed correct (no fix needed)

- **`decideOperationalAction()` never mutates business-outcome state on ambiguous input**:
  `NEEDS_MANUAL_REVIEW`/`UNKNOWN` always resolve to `MANUAL_REVIEW_HOLD` + `MANUAL_REPLY_REVIEW` —
  a reversible, no-auto-expiry hold requiring a human's correction or explicit release, never a
  silent guess either way (continue or suppress).
- **`PERMANENT_SUPPRESSION`/`DELIVERABILITY_BLOCK` structurally cannot auto-resume**: both are
  created with `expiresAt: null`; `listExpiredActive()` filters on a real non-null `expiresAt`, so
  it can never return one — "never automatically resume a permanently suppressed target" (Phase 10)
  is a structural guarantee, not merely an assertion in code.
- **Cross-user authorization on every new M30 route**: `RecruitmentOperationsController`'s
  list/get/release-control and complete/dismiss/confirm-due-date-task endpoints are either scoped
  by `user.sub` directly in the repository query, or go through `requireOwnedControl()`/
  `RecruitmentTaskService.requireOwnedTask()` — both the identical anti-enumeration
  `NotFoundException` shape as `InboxIntelligenceController.requireOwnedMessage()`. Verified live:
  every route returns 401 unauthenticated; `Admin*` routes are additionally role-guarded.
- **Notification dedup for all 7 new M30 notification kinds**: `PrismaRecruitmentNotificationAdapter`
  writes to the SAME `notifications` table and the SAME `@@unique([userId, dedupeKey])` constraint
  M29's own `notification-dedup.concurrency.spec.ts` already proved race-safe under real
  concurrency — the mechanism is table/constraint-level, not kind-specific, so no duplicate test was
  needed for the new kinds specifically. Every M30 call site uses a deterministic dedupe key
  (`TASK_DEADLINE_REMINDER:${task.id}`, `TASK_OVERDUE_ESCALATION:${task.id}`,
  `${notificationKind}:${created.id}`).
- **Idempotency under duplicate provider events**: both `FollowUpControlService.recordControl()`
  and `RecruitmentTaskService.createTask()` use a deterministic idempotency key
  (`followup-control:${applicationId}:${sourceInboxMessageId ?? 'manual'}:${controlType}` /
  `recruitment-task:${applicationId}:${sourceInboxMessageId ?? 'manual'}:${taskType}`) backed by a
  real DB `@unique` constraint, with a check-then-create-with-catch-and-refetch pattern matching
  M29's own `NotificationRepository.createIfNotDuplicate()` — proven race-safe there under real
  concurrency, same shape reused here.
- **`CampaignBatchDispatchService`'s new eligibility check introduces no new intra-batch race**:
  `dispatchBatch()` awaits `dispatchOneTarget()` sequentially per target within one batch run — the
  new eligibility check runs safely inside whatever cross-tick locking already existed
  (M26's Postgres-lock-race fix, unrelated to this milestone) before this milestone's own code ever
  runs.

## Concurrency backstops (proven live, not just reasoned about)

| Constraint | Proven by |
|---|---|
| One ACTIVE `ApplicationFollowUpControl` per application (partial unique index, `applicationId` WHERE `status='ACTIVE'`) | `follow-up-control-active-per-application.concurrency.spec.ts` — 4 tests: concurrent first-time creates (exactly 1 ACTIVE row survives), sequential supersede, concurrent supersedes after a real prior active control, two unrelated applications never interfere |
| `ApplicationTransitionProposal` exactly-once `PENDING → {CONFIRMED,REJECTED}` transition | `application-transition-proposal-exactly-once.concurrency.spec.ts` — 4 tests, see Finding #3 above |
| `RecruitmentActionTask`/`ApplicationFollowUpControl` idempotency (`idempotencyKey @unique`) | Reuses the exact `EmailMessage`/`Notification` pattern already proven under M28/M29's own concurrency specs — same repository shape, same constraint-backed guarantee |
| `Notification` dedup (`@@unique([userId, dedupeKey])`) — reused, not new | `notification-dedup.concurrency.spec.ts` (M29) — still passes unmodified with M30's new notification kinds flowing through the same table |

All concurrency spec files run against the real, live Postgres instance
(`pnpm test:concurrency`), not mocked. This milestone's full run: 9 suites, 27 tests, all passing.
