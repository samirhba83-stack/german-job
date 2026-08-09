# Milestone 30 — Reply-to-Execution Integration, Follow-Up Suppression & Recruitment Workflow Orchestration

## What this milestone is

Turns Milestone 29's inbox-intelligence *conclusions* into safe, real, explainable recruitment
*operations*. Before M30, a classified reply produced a proposal a candidate could confirm — but
confirming most proposal types did nothing to the real world (only 3 of 9 possible actions
dispatched a real command), and a reply-driven "pause" never actually stopped a future campaign
send. M30 closes both gaps with two new, additive concepts — `ApplicationFollowUpControl` (a real
follow-up suppression/hold) and `RecruitmentActionTask` (a real candidate-facing next-action item)
— plus 6 new, additive Applications-module commands, wired through a single always-executed
eligibility gate inside the one real per-target dispatch path this codebase has
(`CampaignBatchDispatchService.dispatchOneTarget()`).

Every new capability ships behind its own production safety gate, defaulting to `false` — this
milestone is real, live-tested code, not yet a live production behavior change.

## Architecture

```
  Classified reply (M29 ReplyIngestionService)
          │
          ▼
  decideOperationalAction(category, facts)      ── pure, M30 Phase 2 ── ReplyOperationalDecisionPolicy
          │
          ├── controlType? ──► FollowUpControlService.recordControl()
          │                     (createSuperseding — old ACTIVE row → SUPERSEDED, new row → ACTIVE;
          │                      partial unique index is the real one-active-per-application backstop)
          │
          └── taskType? ────► RecruitmentTaskService.createTask()
                                (idempotent by (applicationId, sourceInboxMessageId, taskType))

  ApplicationTransitionProposalService.createProposal() / confirmProposal()
          │
          ├── 3 pre-existing actions → real CommandBus dispatch (REPLY_RECEIVED, INTERVIEW_INVITED, REJECTED)
          ├── 6 NEW additive actions → OperationalDecisionCommandHelper → ApplicationOperationalDecision row
          │    (DOCUMENTS_REQUESTED, INFORMATION_REQUESTED, ASSESSMENT_INVITED, UNDER_REVIEW, WAITING,
          │     OFFER_EVIDENCE_RECORDED — none touch Application.status)
          └── OFFER_RECEIVED → RecordExternalOfferEvidenceCommand only (OfferPolicy's COMPANY-actor
               requirement is never bypassed — see known-limitations.md #1, inherited from M29)

  ── Later, on the next real campaign batch ──

  CampaignBatchDispatchService.dispatchOneTarget()
          │
          ├── findOrCreateApplication()             ← real applicationId resolved
          ├── FollowUpEligibilityService.checkEligibility(applicationId, userId)   ← THE gate
          │     (behind REPLY_DRIVEN_EXECUTION_ENABLED; skipped entirely while false)
          │     ELIGIBLE ─────────────────────────────────────────────┐
          │     PERMANENTLY_BLOCKED / TEMPORARILY_BLOCKED /            │
          │     MANUAL_REVIEW_REQUIRED → campaign.excludeTarget()      │
          │     (real, audited, never silently dropped)                │
          └──────────────────────────────────────────────────────────►│
                                                                        ▼
                                                          real provider send (unchanged path)

  ── Independently, on a schedule ──

  RecruitmentOperationsTickDriverService
          ├── FollowUpResumeService.processExpiredHolds()     — real-time expiry already honored by
          │     the evaluator itself; the tick closes out the historical row (ACTIVE → EXPIRED), or
          │     supersedes with PERMANENT_SUPPRESSION if the application moved on some other way
          └── RecruitmentTaskDeadlineService                  — due-date reminders (48h lead) + overdue escalation
```

## The 15 non-negotiable principles — how each is enforced in code

| # | Principle | Enforcement |
|---|---|---|
| 1 | Never overwrite historical delivery/decision records | `FollowUpControlService.recordControl()` always calls `createSuperseding()` — old ACTIVE row → SUPERSEDED, never rewritten in place; `FollowUpControlRepository.release()` only ever called from an `ACTIVE`-status-guarded path (`FollowUpControlService.release()` / `.releaseAsAdmin()`) |
| 2 | Never use `CampaignTarget` delivery status as follow-up suppression | `ApplicationFollowUpControl` is a wholly new, dedicated table — `CampaignTarget.markSkipped()`/`markExcluded()` are never called for suppression reasons |
| 3 | Dedicated follow-up-control concept | `ApplicationFollowUpControl` — 5 `FollowUpControlType`s (`TEMPORARY_HOLD`, `PERMANENT_SUPPRESSION`, `WAITING_PERIOD`, `MANUAL_REVIEW_HOLD`, `DELIVERABILITY_BLOCK`), 4 `FollowUpControlStatus`es (`ACTIVE`, `RELEASED`, `EXPIRED`, `SUPERSEDED`) |
| 4 | Never send a follow-up after a relevant reply when an active suppression exists | `FollowUpEligibilityService.checkEligibility()` — the one, always-executed pre-send gate |
| 5 | Never silently resume follow-ups | `FollowUpResumeService` only acts on real `expiresAt` timers or an explicit user/admin release; never resumes `PERMANENT_SUPPRESSION`/`DELIVERABILITY_BLOCK` (structurally impossible — those are created with `expiresAt: null`, so `listExpiredActive()` can never return one) |
| 6 | Never auto-apply high-impact outcomes without confirmation | `AUTOMATIC_HIGH_IMPACT_TRANSITIONS_ENABLED` deliberately wired to nothing; `ApplicationTransitionProposalService.confirmProposal()` always requires an explicit prior user request |
| 7 | Never weaken `OfferPolicy` or fabricate an actor to bypass it | `OFFER_RECEIVED` proposals dispatch `RecordExternalOfferEvidenceCommand` only — never `ReceiveOfferCommand` |
| 8 | Never represent a proposed action as completed | `confirmProposal()` atomically claims the proposal (`PENDING → CONFIRMED`) *then* dispatches; on a genuinely unexpected (non-domain-guard) failure the claim rolls back to `PENDING` rather than leaving a false `CONFIRMED` |
| 9 | Never create duplicates from duplicate provider events | Every writer (`FollowUpControlService`, `RecruitmentTaskService`) is keyed by a deterministic `idempotencyKey` backed by a real DB `@unique` constraint |
| 10 | Never send an automatic reply this milestone | Unrelated to sending at all — M30 never touches `ReplyDraftService`/`approveAndSend()` |
| 11 | No AI provider | Unchanged from M29 — `decideOperationalAction()` is pure, deterministic, rule-based |
| 12 | Preserve inbox/sending consent separation | M30 never touches `ConnectedMailbox`/inbox-consent tables at all |
| 13 | Every decision exposes source/evidence/confidence/actor | `ApplicationFollowUpControl`/`RecruitmentActionTask` both carry `classification`, `confidence`, `evidence`, `sourceInboxMessageId`, `createdByActorType` |
| 14 | Every mutation uses an authoritative domain service/command | `FollowUpControlService`/`RecruitmentTaskService` are each the ONE writer of their table; the 6 new commands go through `OperationalDecisionCommandHelper`, never a raw repository call from inbox code |
| 15 | Inbox code never writes directly into application/campaign/execution tables | `ReplyIngestionService` calls `FollowUpControlService`/`RecruitmentTaskService`/`ApplicationTransitionProposalService` — never a Prisma client for those tables directly |

## What's real vs reserved this milestone

**Real, live, working, test-covered end-to-end:** the full decision matrix (11 reply categories →
follow-up action + task type), `ApplicationFollowUpControl` creation/release/expiry/resume with a
DB-enforced one-active-per-application invariant, `FollowUpEligibilityService`'s always-executed
pre-send gate wired into the real production dispatch path, `RecruitmentActionTask`
creation/completion/dismissal/deadline-confirmation, 6 new additive Applications commands (never
touching `Application.status`), the transition-proposal confirmation policy's real ownership check
+ atomic exactly-once claim (both closing pre-existing gaps — see
[threat-model.md](./threat-model.md)), 21 new audit event types, a real (if honest-exception)
Mission Control projection, and a real Tasks/follow-up-controls frontend.

**Reserved, deliberately not activated this milestone:** all 4 production safety gates
(`REPLY_DRIVEN_EXECUTION_ENABLED`, `FOLLOW_UP_SUPPRESSION_ENABLED`,
`RECRUITMENT_TASK_AUTOMATION_ENABLED`, `AUTOMATIC_HIGH_IMPACT_TRANSITIONS_ENABLED`) default `false`
— see [production-safety-gates.md](./production-safety-gates.md). No queued-follow-up cancellation
exists because no such queue exists in this codebase for campaign targets — see
[known-limitations.md](./known-limitations.md) #1 for the full architectural reasoning.

## Documents in this set

- [production-safety-gates.md](./production-safety-gates.md) — every env var / flag and what it actually gates
- [known-limitations.md](./known-limitations.md) — honest, itemized gaps and why each exists
- [threat-model.md](./threat-model.md) — real bugs found and fixed this milestone, concurrency backstops, reviewed-and-confirmed-correct items
- [01-milestone-30-engineering-report.md](./01-milestone-30-engineering-report.md) — full report, test evidence, verdict
