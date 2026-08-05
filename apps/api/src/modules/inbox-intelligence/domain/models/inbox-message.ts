import { CorrelationStatus, CorrelationSignalEvidence } from './correlation';
import { ReplyPrimaryCategory, ReplySecondaryLabel, ClassificationSource } from './reply-taxonomy';
import { ExtractedRecruitmentFacts } from './extracted-facts';

export type InboxMessageReviewStatus = 'PENDING_REVIEW' | 'CONFIRMED' | 'REJECTED' | 'AUTO_ACCEPTED' | 'UNRELATED_CONFIRMED';

/** M29 Phase 7 — the one durable record of a message this application actually considered.
 * Deliberately does NOT carry the full raw body (this milestone's own retention decision:
 * sanitized excerpt only) — `sanitizedExcerpt` is a bounded snippet around the classification
 * evidence, `contentHashSha256` lets a duplicate/tamper check happen without keeping the content
 * itself. */
export interface InboxMessageRecord {
  readonly id: string;
  readonly connectedMailboxId: string;
  readonly providerMessageId: string;
  readonly providerThreadId: string | null;
  readonly rfcMessageId: string | null;
  readonly inReplyTo: string | null;
  readonly referencesHeaders: ReadonlyArray<string>;
  readonly fromAddress: string;
  readonly toAddress: string;
  readonly subject: string;
  readonly receivedAt: Date;

  readonly correlationStatus: CorrelationStatus;
  readonly correlationConfidence: number | null;
  readonly correlationEvidence: ReadonlyArray<CorrelationSignalEvidence>;
  readonly correlatedApplicationId: string | null;
  readonly correlatedCampaignId: string | null;

  readonly contentHashSha256: string;
  readonly sanitizedExcerpt: string | null;
  readonly detectedLanguage: string | null;

  readonly primaryCategory: ReplyPrimaryCategory | null;
  readonly secondaryLabels: ReadonlyArray<ReplySecondaryLabel>;
  readonly classificationConfidence: number | null;
  readonly classificationEvidence: Readonly<Record<string, unknown>> | null;
  readonly classificationSource: ClassificationSource | null;
  readonly classificationRuleIds: ReadonlyArray<string>;
  readonly extractedFacts: ExtractedRecruitmentFacts | null;

  readonly reviewStatus: InboxMessageReviewStatus;
  readonly processedAt: Date | null;

  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateInboxMessageInput {
  readonly connectedMailboxId: string;
  readonly providerMessageId: string;
  readonly providerThreadId: string | null;
  readonly rfcMessageId: string | null;
  readonly inReplyTo: string | null;
  readonly referencesHeaders: ReadonlyArray<string>;
  readonly fromAddress: string;
  readonly toAddress: string;
  readonly subject: string;
  readonly receivedAt: Date;
  readonly correlationStatus: CorrelationStatus;
  readonly correlationConfidence: number | null;
  readonly correlationEvidence: ReadonlyArray<CorrelationSignalEvidence>;
  readonly correlatedApplicationId: string | null;
  readonly correlatedCampaignId: string | null;
  readonly contentHashSha256: string;
  readonly sanitizedExcerpt: string | null;
  readonly detectedLanguage: string | null;
}

export interface InboxMessageClassificationPatch {
  readonly primaryCategory: ReplyPrimaryCategory;
  readonly secondaryLabels: ReadonlyArray<ReplySecondaryLabel>;
  readonly classificationConfidence: number;
  readonly classificationEvidence: Readonly<Record<string, unknown>>;
  readonly classificationSource: ClassificationSource;
  readonly classificationRuleIds: ReadonlyArray<string>;
  readonly extractedFacts: ExtractedRecruitmentFacts;
  readonly reviewStatus: InboxMessageReviewStatus;
  readonly processedAt: Date;
}

export interface InboxMessageReviewPatch {
  readonly reviewStatus: InboxMessageReviewStatus;
}
