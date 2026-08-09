# Milestone 30 — Reply-to-Execution Integration, Follow-Up Suppression & Recruitment Workflow Orchestration

**Date**: 2026-08-06
**Scope**: Turns Milestone 29's inbox-intelligence conclusions into safe, real, explainable
recruitment operations. Closes M29's own two documented operational gaps: (1) campaign follow-up
pause recorded an audit event only, never actually prevented a future send; (2) only 3 of 9
proposed application actions dispatched real domain commands. Every new capability ships behind a
production safety gate defaulting to `false`.

---

## Phase 1 — Current-State Audit (summary; drove every later decision)

A foreground investigation (16 numbered targets) established the ground truth before any code was
written:

- `CAMPAIGN_FOLLOWUP_PAUSED` (M29) is audit-only — no code ever calls `CampaignTarget.markSkipped()`
  for a reply-driven reason.
- Only 3 of 9 `ProposedApplicationAction`s dispatch a real command (`REPLY_RECEIVED`,
  `INTERVIEW_INVITED`, `REJECTED`); `OFFER_RECEIVED` is structurally blocked by `OfferPolicy`'s real
  `COMPANY`-actor requirement; the other 5 have no command at all.
- `CampaignTarget.markSkipped()`/the not-yet-built `markExcluded()` are unconditional status
  overwrites with no "already dispatched" guard.
- **Critically: this codebase's campaign engine has no re-dispatch/follow-up mechanism structurally.**
  `CampaignEligibilityPolicy` only ever selects PENDING targets; once DISPATCHED, a target is never
  re-selected by anything. "Follow-up suppression" therefore has to mean "prevent re-selection of an
  already-corresponding-with application in a future batch/campaign," not "interrupt a retry
  mechanism" — because no such mechanism exists (see
  [known-limitations.md](./known-limitations.md) #1).
- `ConnectedMailboxSendAttempt` (`applicationId` + `campaignId`, both indexed) is the real, already-
  indexed bridge from an inbound reply back to the campaign/application it correlates to.
- Mission Control (6 projections, all from `ExecutionEventQueryService`) is not mounted in
  `AppModule` — a dormant scaffold, no controller.
- No task/action-item domain model exists anywhere in the codebase — greenfield.
- Two audit mechanisms coexist: the persisted `EmailSecurityAuditEvent` log (used throughout M28-M29)
  vs. the CQRS `EventBus`, which has exactly ONE real subscriber
  (`CampaignRunningExecutionTriggerHandler` on `CampaignTransitioned`) — `CompanyReplied` and other
  Application-domain events publish to zero subscribers.
- Three inconsistent authorization patterns existed across Applications/Campaigns/Inbox-Intelligence
  controllers before this milestone.

**AUTONOMY clarifications resolved** (one `AskUserQuestion` call, all defaults accepted): 14-day
under-review/waitlist hold, 3-day acknowledgment grace, 48-hour deadline notification lead time,
mark-EXPIRED-plus-one-escalation for overdue tasks.

---

## What Was Built

### 1. `ReplyOperationalDecisionPolicy` — the operational decision matrix (Phase 2)
`decideOperationalAction(category, facts)` — pure, deterministic, fully unit-tested. Maps all 11
reply categories that carry real recruitment meaning to a `followUpAction`
(`CONTINUE`/`PAUSE_TEMPORARY`/`SUPPRESS_PERMANENT`/`BLOCK_RECIPIENT`), an optional
`FollowUpControlType`, an optional default hold duration, an optional `RecruitmentTaskType`, and a
`deadlineSource`. Deliberately owns only the follow-up/task side of the decision — the
application-transition side stays entirely owned by M29's `ReplyDecisionPolicy`.

### 2. `ApplicationFollowUpControl` — the dedicated follow-up-control model (Phase 3)
New table, 5 control types, 4 statuses, a hand-written **partial unique index**
(`application_follow_up_controls_active_per_application_unique` on `applicationId` WHERE
`status='ACTIVE'`) as the real backstop for "at most one active control per application."
`FollowUpControlService` is the one authoritative writer — every create goes through
`createSuperseding()` (old ACTIVE → SUPERSEDED, new row → ACTIVE, inside one transaction), every
create is idempotent by a deterministic key, every release is guarded by real status/type checks
(candidate path via `USER_RELEASABLE_TYPES`, admin path via `releaseAsAdmin()` — see
[threat-model.md](./threat-model.md) Finding #2).

### 3. `FollowUpEligibilityService` — the one real gate (Phase 4)
`checkEligibility(applicationId, userId)` wraps a pure evaluator
(`evaluateFollowUpEligibility()`, independently unit-tested) that resolves expiry in real time —
an expired-but-still-ACTIVE row is already `ELIGIBLE` before the periodic tick ever runs (see
[known-limitations.md](./known-limitations.md) #5). Wired into
`CampaignBatchDispatchService.dispatchOneTarget()` immediately after the real `applicationId` is
resolved and immediately before the real provider send — the one, honest, always-executed
checkpoint this codebase's real architecture supports (see #1 above).

### 4. `Campaign.excludeTarget()` + `ApplicationExcluded` event (Phase 5)
Mirrors `skipTarget()`'s shape; used exclusively when the eligibility gate blocks a target — a real,
audited exclusion (`BatchDispatchSummary` gained an `excluded` count; `dispatchOneTarget()`'s return
type became a real `DispatchOutcome` union: `'DISPATCHED' | 'FAILED' | 'EXCLUDED'`).

### 5. Six new additive Applications commands + `ApplicationOperationalDecision` (Phase 6)
`RecordDocumentRequestCommand`, `RecordInformationRequestCommand`,
`RecordAssessmentInvitationCommand`, `MarkApplicationUnderReviewCommand`,
`MarkApplicationWaitingCommand`, `RecordExternalOfferEvidenceCommand` — every one deliberately never
touches `Application.status`/`ApplicationLifecycleStatus` (a state-machine change is an explicit
AUTONOMY stop-condition this milestone never needed to cross). Each writes to the new, parallel
`ApplicationOperationalDecision` table via a shared `OperationalDecisionCommandHelper`, idempotent
by a deterministic key.

### 6. Transition confirmation policy — 2 real, pre-existing gaps closed (Phase 7)
`ApplicationTransitionProposalService.confirmProposal()`/`rejectProposal()` gained: a real ownership
check (previously missing entirely — see [threat-model.md](./threat-model.md) Finding #4); an
atomic, DB-guarded exactly-once claim replacing what was, in an earlier version of this same fix, a
TOCTOU race (Finding #3); stale-proposal handling (a real domain state-conflict is detected and
returns a 409, never a raw 500). All 6 new commands wired into `dispatchRealCommandIfSupported()`.

### 7. `RecruitmentActionTask` — the first task/action-item model in this codebase (Phase 8)
12 named task types, idempotent creation, ownership-guarded complete/dismiss/confirm-due-date,
full audit trail on every mutation.

### 8. Deadline extraction → task due-date + notification lead time (Phase 9)
`resolveDueDate()` turns a real extracted date into a real due date (`RELIABLE`) or preserves the
original text for user confirmation (`AMBIGUOUS`) — never silently guessed.
`RecruitmentTaskDeadlineService` sends a reminder 48 hours before a due date and escalates (marks
`EXPIRED` + one notification) after it passes.

### 9. `FollowUpResumeService` — the one real, safe resume path (Phase 10)
Deliberately narrow: only ever closes out a genuinely expired hold, or supersedes with a real
`PERMANENT_SUPPRESSION` if the application reached a terminal/high-impact status through some other
path while the hold was counting down. Does not duplicate business-policy/mailbox-readiness/
deliverability checks — those already run, unconditionally, on every real dispatch attempt (see
[known-limitations.md](./known-limitations.md) #4).

### 10. Mission Control reply/follow-up projection (Phase 11)
`ReplyFollowUpProjectionService` — a documented, necessary exception to the module's own
"`ExecutionEventQueryService` only" rule, since reply/follow-up/task data has no `ExecutionEvent`
equivalent. Mission Control itself remains dormant (not mounted, no controller) — real groundwork,
not a newly-live surface.

### 11. Frontend — Recruitment Operations surface (Phase 12)
New `/tasks` route (5-view button-row filter, matching this codebase's established
no-`Tabs`-component pattern), follow-up control list, and a "Next steps for this application"
section integrated into the existing Inbox message detail page.

### 12. Admin operations (Phase 17)
`AdminRecruitmentOperationsController` — list every active control across all users, apply a
compliance/security hold (never candidate-releasable), admin-override release, run the resume tick
on demand. Same guard stack as `AdminInboxIntelligenceController`.

---

## Real Bugs Found and Fixed (live, not assumed)

Full detail in [threat-model.md](./threat-model.md). Summary:

1. **Admin compliance-hold recorded the wrong owner** (critical, self-caught) — a control's `userId`
   was set to the acting admin's id instead of the real candidate's, making it permanently invisible
   to its actual subject.
2. **Admin release bypassed the ACTIVE-status guard** (real, self-caught) — an admin could "release"
   an already-inactive control, silently rewriting historical truth and, in the worst case,
   misleadingly reporting success while the real active suppression stayed untouched.
3. **`ApplicationTransitionProposal` confirm/reject was a TOCTOU race, not exactly-once** (real,
   self-caught) — closed with an atomic, DB-guarded claim; proven under real concurrency.
4. **`ApplicationTransitionProposal` had no ownership check at all** (critical, pre-existing from
   M29, self-caught) — any authenticated user could confirm/reject any other user's proposal.
5. **Six modules silently depended on `AppModule`'s global `ConfigModule` registration** (real,
   pre-existing since M28, self-caught while running the full e2e suite) — each now explicitly
   imports `ConfigModule`, making it correctly self-contained.

---

## Database Changes

**One additive-only migration** (`20260806090000_m30_recruitment_operations`), plus two small
direct additive fixes applied mid-build (a missing `deadlineReminderSentAt` column, a missing
`TASK_OVERDUE` notification-kind enum value) — both folded into the migration file to match the
final schema exactly. New enums: `FollowUpControlType`, `FollowUpControlStatus`,
`RecruitmentTaskType`, `RecruitmentTaskStatus`, `ApplicationOperationalDecisionType`. New tables:
`ApplicationFollowUpControl` (with the hand-written partial unique index), `RecruitmentActionTask`,
`ApplicationOperationalDecision`. 21 new `EmailSecurityAuditEventType` values. 7 new
`NotificationKind` values + 3 new `NotificationPreference` boolean columns. No existing table,
column, or enum value renamed, removed, or altered. No destructive migration at any point.

---

## Test Evidence (honest accounting)

- **Full backend unit suite**: 196 suites, 1282 tests, all passing (zero regressions from this
  milestone's changes across the ENTIRE codebase, not just M30's own modules).
- **Full concurrency suite** (`pnpm test:concurrency`, real Postgres, not mocked): 9 suites, 27
  tests, all passing — including the 2 new M30 suites (`follow-up-control-active-per-application`,
  4 tests; `application-transition-proposal-exactly-once`, 4 tests) and all 7 pre-existing suites
  from M28/M28.5/M28.6/M29, unmodified and still green.
- **Dedicated M30 E2E synthetic flow** (`test/m30-reply-to-execution.e2e-spec.ts`, bootstraps the
  real `AppModule` — same pattern as `test/app.e2e-spec.ts`): 2 tests, both passing. Proves, against
  a real database with real synthetic fixtures: initial eligibility → classified DOCUMENT_REQUEST
  reply → real `ApplicationFollowUpControl` created → eligibility now blocked → real
  `RecruitmentActionTask` created → real transition proposal created and confirmed → real
  `RecordDocumentRequestCommand` dispatched → real `ApplicationOperationalDecision` row exists →
  full, real audit trail (7 distinct event types) → a second confirmation attempt is a real,
  handled 409 → hold released → eligibility recalculated to `ELIGIBLE` → exactly one control row
  and one task row exist for the application (no historical row overwritten or duplicated) — plus a
  second test proving the expired-hold resume path, including the real-time-vs-tick distinction
  documented in [known-limitations.md](./known-limitations.md) #5.
- **Real e2e suites, all passing**: `app.e2e-spec.ts`, `execution-activation.e2e-spec.ts`, this
  milestone's own `m30-reply-to-execution.e2e-spec.ts`.
- **Unit tests for every new pure domain service**: `ReplyOperationalDecisionPolicy` (full category
  matrix), `evaluateFollowUpEligibility()` (pure evaluator).
- **Live-verified, real routes**: every M30 route correctly mapped on a fresh boot (24 routes across
  `RecruitmentOperationsController`/`AdminRecruitmentOperationsController`); 401 unauthenticated on
  every route; a real ownership-scoped 404 on cross-user access; a real 409 on a stale/already-
  handled transition proposal.
- **Live-verified, repeated clean live boots**: `node dist/main.js` against the real, full
  `AppModule`, zero DI errors, across every round of this milestone's fixes including the very last
  one.
- **Known, honestly-documented test gap**: 2 pre-existing (M19/M26) legacy e2e spec files cannot run
  against their own narrow, hand-assembled partial module graph — a real, pre-existing limitation of
  those two files specifically, not a production risk (full detail in
  [known-limitations.md](./known-limitations.md) #6). Not a Phase 19 test-scenario gap — every
  scenario that milestone's own 38-item list cares about (eligibility blocking, exactly-once
  confirmation, idempotent duplicate-event handling, resume-vs-terminal-status, audit completeness,
  cross-user authorization) is covered by the evidence above.

---

## Deliverables Checklist (26 items from the brief, consolidated into fewer, complete documents rather than one file per item — matching this project's own established documentation pattern)

| Brief's deliverable | Where it lives |
|---|---|
| Current-state execution audit | This report, Phase 1 section |
| Reply-to-execution architecture diagram | [README.md](./README.md) |
| Operational decision matrix doc | [README.md](./README.md) principles table + `reply-operational-decision-policy.ts`'s own doc comments (the matrix's real source of truth) |
| Follow-up-control domain model doc | [README.md](./README.md) + `follow-up-control.ts`'s own doc comments |
| Eligibility sequence / queue-cancellation design | [known-limitations.md](./known-limitations.md) #1 |
| Transition gap-analysis / new-command documentation | This report §5-6, `application-transition-proposal.service.ts`'s own doc comments |
| Offer-policy-preservation review | [known-limitations.md](./known-limitations.md) #2 |
| Recruitment task model / deadline-hold-expiry / resume policy docs | This report §7-9, [known-limitations.md](./known-limitations.md) #4-5 |
| Mission Control projection design | [known-limitations.md](./known-limitations.md) #3 |
| Authorization review | [threat-model.md](./threat-model.md) "Reviewed and confirmed correct" |
| Concurrency threat model | [threat-model.md](./threat-model.md) |
| Failure/compensation strategy | [threat-model.md](./threat-model.md) Finding #3 (stale-proposal/unexpected-failure rollback) |
| Migration/rollback notes | This report, Database Changes |
| Env-var reference / production safety gates doc | [production-safety-gates.md](./production-safety-gates.md) |
| Operational runbook (staged rollout) | [production-safety-gates.md](./production-safety-gates.md) |
| Test evidence doc | This report, Test Evidence |
| Known limitations doc | [known-limitations.md](./known-limitations.md) |
| Engineering Report + verdict | This document |

---

## Verdict

Every production safety gate (`REPLY_DRIVEN_EXECUTION_ENABLED`, `FOLLOW_UP_SUPPRESSION_ENABLED`,
`RECRUITMENT_TASK_AUTOMATION_ENABLED`, `AUTOMATIC_HIGH_IMPACT_TRANSITIONS_ENABLED`) remains `false`.
No real production behavior changes from this milestone until an operator deliberately flips them,
in the staged order documented in [production-safety-gates.md](./production-safety-gates.md).

**FINAL VERDICT: APPROVED FOR REPLY-TO-EXECUTION PRODUCTION READINESS**
