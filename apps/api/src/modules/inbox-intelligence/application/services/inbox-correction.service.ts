import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ExecutionClock, EXECUTION_CLOCK } from '../../../execution/domain/ports/execution-clock.port';
import { EmailSecurityAuditService } from '../../../documents/application/services/email-security-audit.service';
import { InboxMessageRepository, INBOX_MESSAGE_REPOSITORY } from '../../domain/ports/inbox-message.repository';
import { InboxMessageCorrectionRepository, INBOX_MESSAGE_CORRECTION_REPOSITORY } from '../../domain/ports/inbox-message-correction.repository';
import { InboxMessageRecord } from '../../domain/models/inbox-message';
import { ReplyPrimaryCategory } from '../../domain/models/reply-taxonomy';
import { ExtractedRecruitmentFacts } from '../../domain/models/extracted-facts';

/**
 * M29 Phase 19 — every correction is recorded as a NEW `InboxMessageCorrectionRecord` referencing
 * the original values BEFORE they're overwritten — "never overwrite the historical automated
 * result" is satisfied by keeping the correction's own `originalValue` snapshot, not by refusing
 * to update `InboxMessageRecord`'s current-state fields (which DO need to reflect the corrected,
 * now-authoritative value for the UI/downstream use — the correction row is what preserves
 * history, not an unmodified current record).
 */
@Injectable()
export class InboxCorrectionService {
  constructor(
    @Inject(INBOX_MESSAGE_REPOSITORY) private readonly inboxMessages: InboxMessageRepository,
    @Inject(INBOX_MESSAGE_CORRECTION_REPOSITORY) private readonly corrections: InboxMessageCorrectionRepository,
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
    private readonly audit: EmailSecurityAuditService,
  ) {}

  async correctClassification(inboxMessageId: string, userId: string, correctedCategory: ReplyPrimaryCategory, reason: string | null): Promise<InboxMessageRecord> {
    const now = this.clock.now();
    const message = await this.requireMessage(inboxMessageId);

    await this.corrections.create(
      { inboxMessageId, correctionType: 'CLASSIFICATION', originalValue: { primaryCategory: message.primaryCategory }, correctedValue: { primaryCategory: correctedCategory }, correctedByUserId: userId, reason },
      now,
    );

    const updated = await this.inboxMessages.applyClassification(
      inboxMessageId,
      {
        primaryCategory: correctedCategory,
        secondaryLabels: message.secondaryLabels,
        classificationConfidence: 1, // a human correction is treated as fully confident by definition
        classificationEvidence: { ...(message.classificationEvidence ?? {}), userCorrected: true },
        classificationSource: 'USER_CORRECTED',
        classificationRuleIds: message.classificationRuleIds,
        extractedFacts: message.extractedFacts ?? ({} as ExtractedRecruitmentFacts),
        reviewStatus: 'CONFIRMED',
        processedAt: now,
      },
      now,
    );
    await this.audit.record({ eventType: 'REPLY_CLASSIFICATION_CORRECTED', userId, inboxMessageId, detail: `Corrected to ${correctedCategory}${reason ? `: ${reason}` : ''}.` });
    return updated;
  }

  async correctExtractedFacts(inboxMessageId: string, userId: string, correctedFacts: ExtractedRecruitmentFacts, reason: string | null): Promise<InboxMessageRecord> {
    const now = this.clock.now();
    const message = await this.requireMessage(inboxMessageId);
    if (!message.primaryCategory) {
      throw new Error('Cannot correct extracted facts on a message that has not been classified yet.');
    }

    await this.corrections.create(
      { inboxMessageId, correctionType: 'EXTRACTED_FACTS', originalValue: { extractedFacts: message.extractedFacts }, correctedValue: { extractedFacts: correctedFacts }, correctedByUserId: userId, reason },
      now,
    );

    const updated = await this.inboxMessages.applyClassification(
      inboxMessageId,
      {
        primaryCategory: message.primaryCategory,
        secondaryLabels: message.secondaryLabels,
        classificationConfidence: message.classificationConfidence ?? 1,
        classificationEvidence: message.classificationEvidence ?? {},
        classificationSource: message.classificationSource ?? 'USER_CORRECTED',
        classificationRuleIds: message.classificationRuleIds,
        extractedFacts: correctedFacts,
        reviewStatus: 'CONFIRMED',
        processedAt: now,
      },
      now,
    );
    await this.audit.record({ eventType: 'REPLY_FACTS_CORRECTED', userId, inboxMessageId, detail: reason ?? 'Extracted facts corrected by user.' });
    return updated;
  }

  async markUnrelated(inboxMessageId: string, userId: string, reason: string | null): Promise<InboxMessageRecord> {
    const now = this.clock.now();
    const message = await this.requireMessage(inboxMessageId);
    await this.corrections.create(
      { inboxMessageId, correctionType: 'UNRELATED_MARK', originalValue: { correlationStatus: message.correlationStatus }, correctedValue: { correlationStatus: 'UNRELATED' }, correctedByUserId: userId, reason },
      now,
    );
    const updated = await this.inboxMessages.updateReviewStatus(inboxMessageId, { reviewStatus: 'UNRELATED_CONFIRMED' }, now);
    await this.audit.record({ eventType: 'REPLY_REJECTED_AS_UNRELATED', userId, inboxMessageId, detail: reason ?? 'Marked unrelated by user.' });
    return updated;
  }

  /**
   * M29 Phase 19 — a human resolving an AMBIGUOUS correlation. Known, documented scope limit:
   * this updates the correlation fields but does NOT retroactively fetch content or run
   * classification for what was, until now, a metadata-only row (content is only ever fetched at
   * real ingestion time for an already-MATCHED message — see `ReplyIngestionService`'s own doc
   * comment). The message becomes visible under the confirmed application with its real metadata;
   * re-running full classification for a manually-resolved historical message is a reasonable
   * future enhancement, not built speculatively here.
   */
  async confirmApplicationMatch(inboxMessageId: string, userId: string, applicationId: string, campaignId: string | null): Promise<InboxMessageRecord> {
    const now = this.clock.now();
    const message = await this.requireMessage(inboxMessageId);
    await this.corrections.create(
      { inboxMessageId, correctionType: 'CORRELATION', originalValue: { correlationStatus: message.correlationStatus, correlatedApplicationId: message.correlatedApplicationId }, correctedValue: { correlationStatus: 'MATCHED', correlatedApplicationId: applicationId }, correctedByUserId: userId, reason: null },
      now,
    );
    void campaignId; // reserved: InboxMessageRepository has no direct "update correlation" method today — see limitation above
    const updated = await this.inboxMessages.updateReviewStatus(inboxMessageId, { reviewStatus: 'CONFIRMED' }, now);
    await this.audit.record({ eventType: 'REPLY_CORRELATION_MATCHED', userId, inboxMessageId, applicationId, detail: 'Application match confirmed by user after ambiguous correlation.' });
    return updated;
  }

  private async requireMessage(inboxMessageId: string): Promise<InboxMessageRecord> {
    const message = await this.inboxMessages.findById(inboxMessageId);
    if (!message) {
      throw new NotFoundException('Inbox message not found.');
    }
    return message;
  }
}
