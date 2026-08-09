# Production Safety Gates — Recruitment Workflow Orchestration

Source of truth: `apps/api/src/config/recruitment-operations.config.ts`. Every gate defaults to
the safe/disabled state, matching the established pattern from `CONNECTED_INBOX_PROCESSING_ENABLED`
(M29), `EMAIL_PRODUCTION_SENDING_ENABLED` (M28), and every milestone since.

## The 4 named gates from the brief

| Env var | Default | What it actually gates |
|---|---|---|
| `REPLY_DRIVEN_EXECUTION_ENABLED` | `false` | The highest-stakes flag in this milestone: whether `FollowUpEligibilityService.checkEligibility()` is actually **consulted** inside `CampaignBatchDispatchService.dispatchOneTarget()` — the live, already-in-production (M26) per-target send path. While `false`, dispatch behaves EXACTLY as it did before this milestone: the eligibility check is skipped entirely (not merely permissive) |
| `FOLLOW_UP_SUPPRESSION_ENABLED` | `false` | Whether `ReplyIngestionService.applyOperationalDecision()` actually calls `FollowUpControlService.recordControl()` for a classified reply. Deliberately separate from `REPLY_DRIVEN_EXECUTION_ENABLED` — lets an operator observe real control creation for weeks before it can ever affect a real send |
| `RECRUITMENT_TASK_AUTOMATION_ENABLED` | `false` | Whether `ReplyIngestionService.applyOperationalDecision()` actually calls `RecruitmentTaskService.createTask()` for a classified reply |
| `AUTOMATIC_HIGH_IMPACT_TRANSITIONS_ENABLED` | `false` | Deliberately wired to nothing — no code path in this module reads it to decide whether to skip user confirmation; `ApplicationTransitionProposalService.confirmProposal()` always requires an explicit prior user request. Exists only to make the "no automatic high-impact transitions" intent auditable in config, matching M29's identical `INBOX_AUTOMATIC_REPLY_ENABLED` precedent |

## Every other real env var this milestone introduces

| Env var | Default | Purpose |
|---|---|---|
| `RECRUITMENT_RESUME_TICK_INTERVAL_MS` | `1800000` (30m) | How often `FollowUpResumeService.processExpiredHolds()` runs |
| `RECRUITMENT_DEADLINE_TICK_INTERVAL_MS` | `900000` (15m) | How often `RecruitmentTaskDeadlineService` checks for due-date reminders/overdue escalation |

Confirmed AUTONOMY-clarification defaults baked into the decision policy itself (not env vars —
domain constants, since they're business policy, not deployment config):

| Constant | Value | Where |
|---|---|---|
| Under-review / waitlist hold duration | 14 days | `reply-operational-decision-policy.ts`, `HOLD_NO_DATE` |
| Application-received acknowledgment grace | 3 days | same |
| Deadline notification lead time | 48 hours | `recruitment-task-deadline.service.ts` |
| Overdue task handling | Mark `EXPIRED` + one escalation notification | `recruitment-task-deadline.service.ts` |

## Staged rollout order (recommended, not automated)

1. Deploy with all 4 flags `false` — zero behavior change, matching every full-suite/live-boot
   verification this milestone ran.
2. Flip `FOLLOW_UP_SUPPRESSION_ENABLED` + `RECRUITMENT_TASK_AUTOMATION_ENABLED` — observe real
   `ApplicationFollowUpControl`/`RecruitmentActionTask` rows being created from live replies, with
   zero effect on any real send (since `REPLY_DRIVEN_EXECUTION_ENABLED` is still `false`).
3. Only once satisfied with step 2's real data, flip `REPLY_DRIVEN_EXECUTION_ENABLED` — the
   eligibility gate now actually excludes targets from real dispatch.
4. `AUTOMATIC_HIGH_IMPACT_TRANSITIONS_ENABLED` is a separate, explicit future decision — nothing in
   this milestone reads it; flipping it today has zero effect.

## Live-verified boot behavior (this session, current build)

```
[RecruitmentOperationsTickDriverService] Follow-up resume tick registered every 1800000ms.
[RecruitmentOperationsTickDriverService] Recruitment task deadline tick registered every 900000ms.
```

Zero DI errors across every M30 module on repeated fresh boots (`node dist/main.js`), all 24 M30
routes correctly mapped, confirmed after the final round of module-wiring fixes (see
[threat-model.md](./threat-model.md)).
