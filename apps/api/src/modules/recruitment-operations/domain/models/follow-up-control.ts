/** M30 Phase 3 — plain TS unions mirroring the Prisma enums, matching this codebase's own
 * "domain layer never imports generated Prisma types" convention (see `inbox-intelligence`'s
 * identical choice for `InboxCapabilityStatus` etc.). */
export type FollowUpControlType = 'TEMPORARY_HOLD' | 'PERMANENT_SUPPRESSION' | 'WAITING_PERIOD' | 'MANUAL_REVIEW_HOLD' | 'DELIVERABILITY_BLOCK';

export type FollowUpControlStatus = 'ACTIVE' | 'RELEASED' | 'EXPIRED' | 'SUPERSEDED';

/**
 * M30 Non-Negotiable Principle #3 — "introduce a dedicated follow-up-control concept instead of
 * corrupting existing campaign execution history." This is the ONE authoritative record of
 * whether an application should currently receive further automated campaign contact.
 * `applicationId` is the reliable key (Phase 1 audit: `Application` has no indexed campaign
 * back-reference; `campaignId`/`companyId`/`jobId` are denormalized for query convenience only,
 * never authoritative on their own). Never mutated in place for a status change that represents a
 * NEW decision — `FollowUpControlService.supersede()` marks the old row SUPERSEDED and creates a
 * new one, preserving the full decision history (Non-Negotiable Principle #1).
 */
export interface FollowUpControlRecord {
  readonly id: string;
  readonly userId: string;
  readonly applicationId: string;
  readonly campaignId: string | null;
  readonly companyId: string | null;
  readonly jobId: string | null;

  readonly sourceInboxMessageId: string | null;
  readonly sourceProviderMessageId: string | null;

  readonly controlType: FollowUpControlType;
  readonly status: FollowUpControlStatus;
  readonly reasonCode: string;
  readonly explanation: string;

  readonly classification: string | null;
  readonly confidence: number | null;
  readonly evidence: Readonly<Record<string, unknown>> | null;

  readonly createdByActorType: string;
  readonly createdByActorId: string | null;
  readonly createdAt: Date;
  readonly effectiveAt: Date;
  readonly expiresAt: Date | null;

  readonly releasedAt: Date | null;
  readonly releasedBy: string | null;
  readonly releaseReason: string | null;

  readonly correlationId: string | null;
  readonly idempotencyKey: string;
  readonly version: number;
  readonly updatedAt: Date;
}

export interface CreateFollowUpControlInput {
  readonly userId: string;
  readonly applicationId: string;
  readonly campaignId: string | null;
  readonly companyId: string | null;
  readonly jobId: string | null;
  readonly sourceInboxMessageId: string | null;
  readonly sourceProviderMessageId: string | null;
  readonly controlType: FollowUpControlType;
  readonly reasonCode: string;
  readonly explanation: string;
  readonly classification: string | null;
  readonly confidence: number | null;
  readonly evidence: Readonly<Record<string, unknown>> | null;
  readonly createdByActorType: string;
  readonly createdByActorId: string | null;
  readonly expiresAt: Date | null;
  readonly correlationId: string | null;
  /** Deterministic per (sourceInboxMessageId, controlType) or per manual-action id — the real,
   * DB-enforced defense against a duplicate provider event creating a second control
   * (Non-Negotiable Principle #9). */
  readonly idempotencyKey: string;
}

/** Every real outcome of an eligibility check (Phase 4) — always includes a structured reason,
 * never a silent skip (Phase 4: "do not silently skip without recording why"). */
export type FollowUpEligibilityStatus = 'ELIGIBLE' | 'TEMPORARILY_BLOCKED' | 'PERMANENTLY_BLOCKED' | 'MANUAL_REVIEW_REQUIRED';

export interface FollowUpEligibilityResult {
  readonly status: FollowUpEligibilityStatus;
  readonly reasonCode: string;
  readonly explanation: string;
  readonly activeControl: FollowUpControlRecord | null;
}
