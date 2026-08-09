import { registerAs } from '@nestjs/config';

/**
 * M30 — Recruitment Workflow Orchestration config. Every flag defaults to the safe/disabled state,
 * matching the established pattern (`CONNECTED_INBOX_PROCESSING_ENABLED` etc., M29).
 *
 * `replyDrivenExecutionEnabled` is the highest-stakes flag in this milestone: it gates whether
 * `FollowUpEligibilityService.checkEligibility()` is actually CONSULTED inside
 * `CampaignBatchDispatchService.dispatchOneTarget()` — the live, already-in-production (M26)
 * per-target send path. While false, dispatch behaves EXACTLY as it did before this milestone
 * (the eligibility check is skipped entirely, not merely permissive) — a deliberately separate,
 * later rollout step from simply observing follow-up controls/tasks getting created.
 *
 * `automaticHighImpactTransitionsEnabled` is deliberately NOT wired to any real code path
 * anywhere in this module (`ApplicationTransitionProposalService.confirmProposal()` always
 * requires an explicit prior user request unconditionally for HIGH_IMPACT_CATEGORIES, matching
 * M29's `ReplyDecisionPolicy`) — exists only to satisfy the brief's own explicit "create this
 * flag, keep it false" instruction, matching `INBOX_AUTOMATIC_REPLY_ENABLED`'s identical M29
 * precedent.
 */
export default registerAs('recruitmentOperations', () => ({
  replyDrivenExecutionEnabled: (process.env.REPLY_DRIVEN_EXECUTION_ENABLED ?? 'false').toLowerCase() === 'true',
  followUpSuppressionEnabled: (process.env.FOLLOW_UP_SUPPRESSION_ENABLED ?? 'false').toLowerCase() === 'true',
  recruitmentTaskAutomationEnabled: (process.env.RECRUITMENT_TASK_AUTOMATION_ENABLED ?? 'false').toLowerCase() === 'true',
  // Non-Negotiable Principle #6 / the brief's own explicit instruction: must remain false.
  automaticHighImpactTransitionsEnabled: (process.env.AUTOMATIC_HIGH_IMPACT_TRANSITIONS_ENABLED ?? 'false').toLowerCase() === 'true',

  tick: {
    resumeIntervalMs: parseInt(process.env.RECRUITMENT_RESUME_TICK_INTERVAL_MS ?? String(30 * 60 * 1000), 10),
    deadlineIntervalMs: parseInt(process.env.RECRUITMENT_DEADLINE_TICK_INTERVAL_MS ?? String(15 * 60 * 1000), 10),
  },
}));
