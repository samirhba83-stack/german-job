import {
  CampaignStatus,
  CampaignTargetStatus,
  ApplicationLifecycleStatus,
  JobStatus,
  SubscriptionStatus,
  CompanyStatus,
} from '@german-job-engine/shared-types';
import type { ConnectedMailboxStatus, InboxCapabilityStatus, ReplyPrimaryCategory, InboxMessageReviewStatus } from '@german-job-engine/shared-types';
import type { FollowUpControlStatus, RecruitmentTaskStatus } from '@german-job-engine/shared-types';
import type { BadgeTone } from '@/components/ui/badge';

/**
 * Status tokens are the single source of truth for every domain enum's visual mapping
 * (docs/frontend-architecture/11-design-system-foundation.md). No screen picks its own tone —
 * every status-to-tone mapping resolves through exactly these four tables.
 */
export const CAMPAIGN_STATUS_TONE: Record<CampaignStatus, BadgeTone> = {
  [CampaignStatus.DRAFT]: 'neutral',
  [CampaignStatus.READY]: 'info',
  [CampaignStatus.RUNNING]: 'positive',
  [CampaignStatus.PAUSED]: 'warning',
  [CampaignStatus.COOLING_DOWN]: 'warning',
  [CampaignStatus.RESUMING]: 'info',
  [CampaignStatus.COMPLETED]: 'positive',
  [CampaignStatus.STOPPED]: 'critical',
  [CampaignStatus.CANCELLED]: 'neutral',
  [CampaignStatus.ARCHIVED]: 'neutral',
};

export const APPLICATION_STATUS_TONE: Record<ApplicationLifecycleStatus, BadgeTone> = {
  [ApplicationLifecycleStatus.DRAFT]: 'neutral',
  [ApplicationLifecycleStatus.PREPARED]: 'info',
  [ApplicationLifecycleStatus.QUEUED]: 'info',
  [ApplicationLifecycleStatus.SENT]: 'info',
  [ApplicationLifecycleStatus.DELIVERED]: 'positive',
  [ApplicationLifecycleStatus.OPENED]: 'positive',
  [ApplicationLifecycleStatus.VIEWED]: 'positive',
  [ApplicationLifecycleStatus.COMPANY_REPLIED]: 'positive',
  [ApplicationLifecycleStatus.INTERVIEW_SCHEDULED]: 'positive',
  [ApplicationLifecycleStatus.INTERVIEW_COMPLETED]: 'positive',
  [ApplicationLifecycleStatus.OFFER_RECEIVED]: 'positive',
  [ApplicationLifecycleStatus.CONTRACT_SIGNED]: 'positive',
  [ApplicationLifecycleStatus.REJECTED]: 'critical',
  [ApplicationLifecycleStatus.WITHDRAWN]: 'neutral',
  [ApplicationLifecycleStatus.ARCHIVED]: 'neutral',
};

/** docs/campaign-workspace/. The only real per-target signal the backend exposes (aggregate
 * counts via `GET /campaigns/:id/execution-status`'s `targetBreakdown`) — no individual target
 * has its own screen yet, but its status still needs the same single-source-of-truth tone. */
export const CAMPAIGN_TARGET_STATUS_TONE: Record<CampaignTargetStatus, BadgeTone> = {
  [CampaignTargetStatus.PENDING]: 'neutral',
  [CampaignTargetStatus.SELECTED]: 'info',
  [CampaignTargetStatus.QUEUED]: 'info',
  [CampaignTargetStatus.DISPATCHED]: 'positive',
  [CampaignTargetStatus.SKIPPED]: 'neutral',
  [CampaignTargetStatus.FAILED]: 'critical',
  [CampaignTargetStatus.EXCLUDED]: 'neutral',
};

/** docs/company-workspace/. The real `CompanyStatus` enum has exactly two values — no `PENDING`,
 * `SUSPENDED`, or richer lifecycle exists on the backend today (verified during Milestone 24's
 * research pass; company-status.enum.ts is a 2-value enum). Any richer "health" framing the
 * Company Workspace shows is a presentational layer on top of these two real states plus other
 * real evidence, never a third stored status this table would need a third entry for. */
export const COMPANY_STATUS_TONE: Record<CompanyStatus, BadgeTone> = {
  [CompanyStatus.ACTIVE]: 'positive',
  [CompanyStatus.ARCHIVED]: 'neutral',
};

export const JOB_STATUS_TONE: Record<JobStatus, BadgeTone> = {
  [JobStatus.DRAFT]: 'neutral',
  [JobStatus.PUBLISHED]: 'positive',
  [JobStatus.ARCHIVED]: 'neutral',
  [JobStatus.CLOSED]: 'critical',
};

/** M27 — kept in sync with the real 5-value SubscriptionStatus enum (no TRIALING in this
 * commercial model; see the enum's own doc comment). */
export const SUBSCRIPTION_STATUS_TONE: Record<SubscriptionStatus, BadgeTone> = {
  [SubscriptionStatus.ACTIVE]: 'positive',
  [SubscriptionStatus.PAST_DUE]: 'warning',
  [SubscriptionStatus.CANCEL_AT_PERIOD_END]: 'warning',
  [SubscriptionStatus.CANCELED]: 'critical',
  [SubscriptionStatus.REFUNDED]: 'neutral',
};

/** M28.6 — the real 7-value `ConnectedMailboxStatus` union (see apps/api's
 * `connected-mailbox/domain/models/connected-mailbox.ts` for the rationale behind each state). */
export const CONNECTED_MAILBOX_STATUS_TONE: Record<ConnectedMailboxStatus, BadgeTone> = {
  PENDING: 'neutral',
  CONNECTED: 'positive',
  REAUTHORIZATION_REQUIRED: 'warning',
  REVOKED: 'critical',
  USER_DISABLED: 'neutral',
  SYSTEM_SUSPENDED: 'critical',
  FAILED: 'critical',
};

/** M29 — the real 8-value `InboxCapabilityStatus` union, the SEPARATE inbox-reading consent
 * lifecycle (independent of `CONNECTED_MAILBOX_STATUS_TONE`, which only ever describes send
 * capability). */
export const INBOX_CAPABILITY_STATUS_TONE: Record<InboxCapabilityStatus, BadgeTone> = {
  NOT_REQUESTED: 'neutral',
  PENDING: 'neutral',
  ACTIVE: 'positive',
  REAUTHORIZATION_REQUIRED: 'warning',
  REVOKED: 'neutral',
  USER_DISABLED: 'neutral',
  SYSTEM_SUSPENDED: 'critical',
  FAILED: 'critical',
};

/** M29 — the real 18-value reply taxonomy. Tone reflects what the category means for the
 * candidate (positive news, negative news, or neutral/automated), not a generic "info" default —
 * this is what lets the Inbox Workspace's "Needs attention" view scan at a glance. */
export const REPLY_PRIMARY_CATEGORY_TONE: Record<ReplyPrimaryCategory, BadgeTone> = {
  INTERVIEW_INVITATION: 'positive',
  ACCEPTANCE_OR_OFFER: 'positive',
  REJECTION: 'critical',
  DOCUMENT_REQUEST: 'warning',
  INFORMATION_REQUEST: 'warning',
  AVAILABILITY_REQUEST: 'warning',
  ASSESSMENT_OR_TEST_INVITATION: 'warning',
  APPLICATION_RECEIVED_CONFIRMATION: 'info',
  APPLICATION_UNDER_REVIEW: 'info',
  WAITLIST_OR_DELAY: 'neutral',
  REFERRAL_TO_OTHER_POSITION: 'info',
  WITHDRAWAL_CONFIRMATION: 'neutral',
  AUTOMATIC_REPLY: 'neutral',
  OUT_OF_OFFICE: 'neutral',
  DELIVERY_FAILURE: 'critical',
  SPAM_OR_UNRELATED: 'neutral',
  NEEDS_MANUAL_REVIEW: 'warning',
  UNKNOWN: 'neutral',
};

export const INBOX_MESSAGE_REVIEW_STATUS_TONE: Record<InboxMessageReviewStatus, BadgeTone> = {
  PENDING_REVIEW: 'warning',
  CONFIRMED: 'positive',
  REJECTED: 'neutral',
  AUTO_ACCEPTED: 'positive',
  UNRELATED_CONFIRMED: 'neutral',
};

/** M30 — the real 4-value `FollowUpControlStatus` union. */
export const FOLLOW_UP_CONTROL_STATUS_TONE: Record<FollowUpControlStatus, BadgeTone> = {
  ACTIVE: 'warning',
  RELEASED: 'neutral',
  EXPIRED: 'neutral',
  SUPERSEDED: 'neutral',
};

/** M30 — the real 5-value `RecruitmentTaskStatus` union. */
export const RECRUITMENT_TASK_STATUS_TONE: Record<RecruitmentTaskStatus, BadgeTone> = {
  OPEN: 'warning',
  IN_PROGRESS: 'info',
  COMPLETED: 'positive',
  DISMISSED: 'neutral',
  EXPIRED: 'critical',
};

/** Human-readable label — real enum value, title-cased, never a paraphrase that could drift
 * from the actual backend state. */
export function humanizeStatus(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(' ');
}
