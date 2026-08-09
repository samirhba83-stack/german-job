import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConnectedMailboxRecord } from '../../../connected-mailbox/domain/models/connected-mailbox';
import { ConnectedMailboxSendAttemptRepository, CONNECTED_MAILBOX_SEND_ATTEMPT_REPOSITORY } from '../../../connected-mailbox/domain/ports/connected-mailbox-send-attempt.repository';
import { ExecutionClock, EXECUTION_CLOCK } from '../../../execution/domain/ports/execution-clock.port';
import { EmailSecurityAuditService } from '../../../documents/application/services/email-security-audit.service';
import { ConnectedInboxProviderPort, CONNECTED_INBOX_PROVIDERS } from '../../domain/ports/connected-inbox-provider.port';
import { InboxMessageRepository, INBOX_MESSAGE_REPOSITORY } from '../../domain/ports/inbox-message.repository';
import { AiClassificationPort, AI_CLASSIFICATION_PORT } from '../../domain/ports/ai-classification.port';
import { ChangedMessageRef } from '../../domain/models/provider-inbox-message';
import { scoreCorrelation, SentMessageRef } from '../../domain/services/reply-correlation-scoring';
import { checkPrivacyGate } from '../../domain/services/privacy-filter-policy';
import { normalizeProviderMessage } from '../../domain/services/content-normalizer';
import { classifyByRules } from '../../domain/services/reply-rule-engine';
import { decideReplyAction } from '../../domain/services/reply-decision-policy';
import { decideOperationalAction } from '../../domain/services/reply-operational-decision-policy';
import { ReplyPrimaryCategory } from '../../domain/models/reply-taxonomy';
import { ExtractedRecruitmentFacts, DateExtraction } from '../../domain/models/extracted-facts';
import { InboxAccessTokenService } from './inbox-access-token.service';
import { ApplicationTransitionProposalService } from './application-transition-proposal.service';
import { NotificationService } from './notification.service';
import { NotificationKind } from '../../domain/models/notification';
import { FollowUpControlService } from '../../../recruitment-operations/application/services/follow-up-control.service';
import { RecruitmentTaskService } from '../../../recruitment-operations/application/services/recruitment-task.service';
import { RecruitmentTaskType } from '../../../recruitment-operations/domain/models/recruitment-task';

const EXCERPT_MAX_LENGTH = 600;

const NOTIFICATION_KIND_BY_CATEGORY: Readonly<Partial<Record<ReplyPrimaryCategory, NotificationKind>>> = {
  INTERVIEW_INVITATION: 'INTERVIEW_INVITATION',
  ACCEPTANCE_OR_OFFER: 'OFFER_OR_ACCEPTANCE',
  REJECTION: 'REJECTION',
  DOCUMENT_REQUEST: 'DOCUMENTS_REQUESTED',
  ASSESSMENT_OR_TEST_INVITATION: 'ASSESSMENT_INVITATION',
};

/**
 * M29 — the one authoritative per-message pipeline: privacy filter → correlation → (only if
 * MATCHED and the gate passes) content fetch → normalization → rule-based classification → AI
 * classification only if rules were insufficient and AI is available → decision policy →
 * transition proposal → notification. Content is NEVER fetched for UNRELATED/UNSAFE_TO_PROCESS/
 * AMBIGUOUS messages (Phase 7: "before message content enters classification... verify the
 * message correlates to a known application") — only metadata (headers) is ever read for those.
 */
@Injectable()
export class ReplyIngestionService {
  private readonly logger = new Logger(ReplyIngestionService.name);

  constructor(
    @Inject(CONNECTED_MAILBOX_SEND_ATTEMPT_REPOSITORY) private readonly sendAttempts: ConnectedMailboxSendAttemptRepository,
    @Inject(CONNECTED_INBOX_PROVIDERS) private readonly inboxProviders: ConnectedInboxProviderPort[],
    @Inject(INBOX_MESSAGE_REPOSITORY) private readonly inboxMessages: InboxMessageRepository,
    @Inject(AI_CLASSIFICATION_PORT) private readonly aiClassification: AiClassificationPort,
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
    private readonly accessTokens: InboxAccessTokenService,
    private readonly transitionProposals: ApplicationTransitionProposalService,
    private readonly notifications: NotificationService,
    private readonly followUpControls: FollowUpControlService,
    private readonly recruitmentTasks: RecruitmentTaskService,
    private readonly audit: EmailSecurityAuditService,
    private readonly config: ConfigService,
  ) {}

  async ingestChangedMessage(mailbox: ConnectedMailboxRecord, changedRef: ChangedMessageRef): Promise<void> {
    const alreadyProcessed = await this.inboxMessages.findByConnectedMailboxIdAndProviderMessageId(mailbox.id, changedRef.providerMessageId);
    if (alreadyProcessed) return; // real idempotency — a redelivered notification is a silent no-op

    const adapter = this.inboxProviders.find((p) => p.provider === mailbox.provider);
    if (!adapter) {
      this.logger.warn(`No connected-inbox provider adapter registered for "${mailbox.provider}".`);
      return;
    }
    const accessToken = await this.accessTokens.getValidAccessToken(mailbox);
    const metadata = await adapter.fetchMessageMetadata(accessToken, changedRef.providerMessageId);

    const isOutgoingFromOwnMailbox = metadata.fromAddress.toLowerCase() === mailbox.emailAddress.toLowerCase();

    const [matchByThreadId, matchByInReplyTo, matchesByReferences] = await Promise.all([
      metadata.providerThreadId ? this.toSentMessageRef(mailbox.id, await this.sendAttempts.findByProviderThreadId(mailbox.id, metadata.providerThreadId)) : Promise.resolve(null),
      metadata.inReplyTo ? this.toSentMessageRef(mailbox.id, await this.sendAttempts.findByRfcMessageId(mailbox.id, metadata.inReplyTo)) : Promise.resolve(null),
      Promise.all(metadata.referencesHeaders.map(async (ref) => this.toSentMessageRef(mailbox.id, await this.sendAttempts.findByRfcMessageId(mailbox.id, ref)))),
    ]);

    const correlation = scoreCorrelation({ matchByThreadId, matchByInReplyTo, matchesByReferences: matchesByReferences.filter((m): m is SentMessageRef => m !== null) });

    const gate = checkPrivacyGate({
      inboxCapabilityActive: mailbox.inboxCapabilityStatus === 'ACTIVE',
      correlationStatus: correlation.status,
      alreadyProcessed: false,
      isOutgoingFromOwnMailbox,
      sizeBytes: metadata.sizeEstimateBytes,
      maxAllowedSizeBytes: this.config.get<number>('inboxIntelligence.maxMessageSizeBytes', 5 * 1024 * 1024),
    });

    if (correlation.status === 'UNRELATED' || correlation.status === 'UNSAFE_TO_PROCESS') {
      await this.audit.record({
        eventType: correlation.status === 'UNRELATED' ? 'REPLY_REJECTED_AS_UNRELATED' : 'REPLY_CORRELATION_AMBIGUOUS',
        userId: mailbox.userId,
        connectedMailboxId: mailbox.id,
        detail: `${correlation.status}: ${correlation.evidence.map((e) => e.detail).join('; ')}`,
      });
      return; // never persisted — Non-Negotiable Principle #6
    }

    const now = this.clock.now();
    const contentHash = createHash('sha256').update(`${metadata.providerMessageId}:${metadata.subject}:${metadata.fromAddress}:${metadata.receivedAt.toISOString()}`).digest('hex');

    if (correlation.status === 'AMBIGUOUS' || !gate.allowed) {
      // Persisted for the manual-review queue — metadata only, content never fetched.
      const created = await this.inboxMessages.create(
        {
          connectedMailboxId: mailbox.id,
          providerMessageId: metadata.providerMessageId,
          providerThreadId: metadata.providerThreadId,
          rfcMessageId: metadata.rfcMessageId,
          inReplyTo: metadata.inReplyTo,
          referencesHeaders: metadata.referencesHeaders,
          fromAddress: metadata.fromAddress,
          toAddress: metadata.toAddresses[0] ?? '',
          subject: metadata.subject,
          receivedAt: metadata.receivedAt,
          correlationStatus: correlation.status,
          correlationConfidence: correlation.confidence,
          correlationEvidence: correlation.evidence,
          correlatedApplicationId: null,
          correlatedCampaignId: null,
          contentHashSha256: contentHash,
          sanitizedExcerpt: null,
          detectedLanguage: null,
        },
        now,
      );
      await this.audit.record({ eventType: 'REPLY_CORRELATION_AMBIGUOUS', userId: mailbox.userId, connectedMailboxId: mailbox.id, inboxMessageId: created.id, detail: gate.blockingReasons.join('; ') || 'Ambiguous correlation.' });
      await this.notifications.notify({
        userId: mailbox.userId,
        kind: 'AMBIGUOUS_REPLY_REVIEW',
        relatedInboxMessageId: created.id,
        relatedApplicationId: null,
        title: 'A reply needs manual review',
        body: `A message from ${metadata.fromAddress} could not be automatically matched to one of your applications.`,
        dedupeKey: `AMBIGUOUS_REPLY_REVIEW:${created.id}`,
      });
      return;
    }

    // MATCHED and the gate passes — only now is content ever fetched.
    const content = await adapter.fetchMessageContent(accessToken, changedRef.providerMessageId);
    const normalized = normalizeProviderMessage(content);
    const ruleResult = classifyByRules(normalized);

    let finalCategory = ruleResult.category;
    let finalConfidence = ruleResult.confidence;
    let finalSecondaryLabels = ruleResult.secondaryLabels;
    let finalEvidence: Record<string, unknown> = { ruleEvidence: ruleResult.evidence };
    let finalExtractedFacts = ruleResult.extractedFacts;
    const classificationSource = ruleResult.rulesWereSufficient ? ('RULE_ENGINE' as const) : ('RULE_ENGINE' as const);

    if (!ruleResult.rulesWereSufficient && this.aiClassification.available) {
      try {
        const aiResult = await this.aiClassification.classify({
          candidateRelevantBody: normalized.candidateRelevantBody,
          subject: normalized.subject,
          detectedLanguage: normalized.detectedLanguage,
          ruleEngineHint: null,
        });
        finalCategory = aiResult.primaryCategory;
        finalConfidence = aiResult.confidence;
        finalSecondaryLabels = aiResult.secondaryLabels;
        finalEvidence = { aiEvidenceSpans: aiResult.evidenceSpans, aiSummary: aiResult.summary };
        finalExtractedFacts = aiResult.extractedFacts;
      } catch (error) {
        this.logger.warn(`AI classification failed, keeping rule-engine result: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const excerpt = normalized.candidateRelevantBody.slice(0, EXCERPT_MAX_LENGTH);

    const created = await this.inboxMessages.create(
      {
        connectedMailboxId: mailbox.id,
        providerMessageId: metadata.providerMessageId,
        providerThreadId: metadata.providerThreadId,
        rfcMessageId: metadata.rfcMessageId,
        inReplyTo: metadata.inReplyTo,
        referencesHeaders: metadata.referencesHeaders,
        fromAddress: metadata.fromAddress,
        toAddress: metadata.toAddresses[0] ?? '',
        subject: metadata.subject,
        receivedAt: metadata.receivedAt,
        correlationStatus: 'MATCHED',
        correlationConfidence: correlation.confidence,
        correlationEvidence: correlation.evidence,
        correlatedApplicationId: correlation.correlatedApplicationId,
        correlatedCampaignId: correlation.correlatedCampaignId,
        contentHashSha256: contentHash,
        sanitizedExcerpt: excerpt,
        detectedLanguage: normalized.detectedLanguage,
      },
      now,
    );

    const decision = decideReplyAction(finalCategory, finalConfidence);

    await this.inboxMessages.applyClassification(
      created.id,
      {
        primaryCategory: finalCategory,
        secondaryLabels: finalSecondaryLabels,
        classificationConfidence: finalConfidence,
        classificationEvidence: finalEvidence,
        classificationSource,
        classificationRuleIds: ruleResult.matchedRuleIds,
        extractedFacts: finalExtractedFacts,
        reviewStatus: decision.reviewStatus,
        processedAt: now,
      },
      now,
    );

    await this.audit.record({
      eventType: 'REPLY_CLASSIFIED',
      userId: mailbox.userId,
      connectedMailboxId: mailbox.id,
      applicationId: correlation.correlatedApplicationId ?? undefined,
      inboxMessageId: created.id,
      detail: `Classified as ${finalCategory} (confidence ${finalConfidence.toFixed(2)}, source ${classificationSource}).`,
    });
    await this.audit.record({ eventType: 'REPLY_FACTS_EXTRACTED', userId: mailbox.userId, connectedMailboxId: mailbox.id, inboxMessageId: created.id, detail: 'Structured facts extracted.' });

    if (decision.shouldProposeTransition && correlation.correlatedApplicationId) {
      const proposal = await this.transitionProposals.createProposal(
        {
          inboxMessageId: created.id,
          applicationId: correlation.correlatedApplicationId,
          category: finalCategory,
          confidence: finalConfidence,
          evidence: finalEvidence,
          extractedFacts: finalExtractedFacts,
          correlationId: created.id,
        },
        mailbox.userId,
      );
      if (proposal && !decision.requiresExplicitConfirmation) {
        await this.transitionProposals.confirmProposal(proposal.id, mailbox.userId);
      }
    }

    await this.applyOperationalDecision(mailbox.userId, correlation.correlatedCampaignId, correlation.correlatedApplicationId, created.id, metadata.providerMessageId, finalCategory, finalExtractedFacts, finalConfidence, finalEvidence, created.id);

    const notificationKind = NOTIFICATION_KIND_BY_CATEGORY[finalCategory];
    if (notificationKind) {
      await this.notifications.notify({
        userId: mailbox.userId,
        kind: notificationKind,
        relatedInboxMessageId: created.id,
        relatedApplicationId: correlation.correlatedApplicationId,
        title: this.notificationTitleFor(finalCategory),
        body: `From ${metadata.fromAddress}: ${metadata.subject}`,
        dedupeKey: `${notificationKind}:${created.id}`,
      });
    }
  }

  private async toSentMessageRef(_connectedMailboxId: string, sendAttempt: Awaited<ReturnType<ConnectedMailboxSendAttemptRepository['findByProviderThreadId']>>): Promise<SentMessageRef | null> {
    if (!sendAttempt) return null;
    return { connectedMailboxSendAttemptId: sendAttempt.id, applicationId: sendAttempt.applicationId, campaignId: sendAttempt.campaignId };
  }

  private notificationTitleFor(category: ReplyPrimaryCategory): string {
    switch (category) {
      case 'INTERVIEW_INVITATION':
        return 'Interview invitation received';
      case 'ACCEPTANCE_OR_OFFER':
        return 'Offer received';
      case 'REJECTION':
        return 'Application update';
      case 'DOCUMENT_REQUEST':
        return 'Documents requested';
      case 'ASSESSMENT_OR_TEST_INVITATION':
        return 'Assessment invitation received';
      default:
        return 'New reply received';
    }
  }

  /**
   * M29 Phase 14 / M30 Phase 2-5 — real follow-up suppression + recruitment task creation, using
   * `decideOperationalAction()` (the M30 operational decision matrix) to translate a classified
   * reply into a real `ApplicationFollowUpControl` and (where warranted) a real
   * `RecruitmentActionTask`. Deliberately lives here (not a separate `CompanyReplied` EventBus
   * subscriber) because the real campaign id is only available from THIS message's own
   * correlation (`ConnectedMailboxSendAttempt.campaignId`, captured at send time) — `Application`
   * itself has no queryable `campaignId` back-reference (M23/M30 audit).
   *
   * Gated behind `FOLLOW_UP_SUPPRESSION_ENABLED`/`RECRUITMENT_TASK_AUTOMATION_ENABLED` (both
   * default `false`) — a deliberately separate, later rollout step from the higher-stakes
   * dispatch-side enforcement flag (`REPLY_DRIVEN_EXECUTION_ENABLED`, checked inside
   * `CampaignBatchDispatchService`), so this milestone's inbox-side observability can be validated
   * before the live send path is ever actually affected.
   */
  private async applyOperationalDecision(
    userId: string,
    campaignId: string | null,
    applicationId: string | null,
    inboxMessageId: string,
    providerMessageId: string,
    category: ReplyPrimaryCategory,
    facts: ExtractedRecruitmentFacts,
    confidence: number,
    evidence: Readonly<Record<string, unknown>>,
    correlationId: string,
  ): Promise<void> {
    if (!applicationId) return; // a follow-up control is keyed by applicationId — nothing to record without one
    const decision = decideOperationalAction(category, facts);

    if (decision.controlType && this.config.get<boolean>('recruitmentOperations.followUpSuppressionEnabled', false)) {
      const expiresAt = decision.defaultHoldDurationDays ? new Date(this.clock.now().getTime() + decision.defaultHoldDurationDays * 24 * 60 * 60 * 1000) : null;
      await this.followUpControls.recordControl({
        userId,
        applicationId,
        campaignId,
        companyId: null,
        jobId: null,
        sourceInboxMessageId: inboxMessageId,
        sourceProviderMessageId: providerMessageId,
        controlType: decision.controlType,
        reasonCode: category,
        explanation: `${decision.followUpAction === 'SUPPRESS_PERMANENT' ? 'Permanently suppressed' : decision.followUpAction === 'BLOCK_RECIPIENT' ? 'Recipient blocked' : 'Temporarily held'} after a ${category} reply.`,
        classification: category,
        confidence,
        evidence,
        expiresAt,
        correlationId,
      });
    }

    if (decision.taskType && this.config.get<boolean>('recruitmentOperations.recruitmentTaskAutomationEnabled', false)) {
      const { dueAt, dueDateConfidence, originalDateText } = this.resolveDueDate(decision.deadlineSource, facts);
      await this.recruitmentTasks.createTask({
        userId,
        applicationId,
        companyId: null,
        jobId: null,
        sourceInboxMessageId: inboxMessageId,
        taskType: decision.taskType,
        title: this.taskTitleFor(decision.taskType),
        explanation: `Created from a ${category} reply.`,
        evidence,
        priority: decision.taskType === 'MANUAL_REPLY_REVIEW' ? 'HIGH' : 'NORMAL',
        dueAt,
        dueDateConfidence,
        originalDateText,
        correlationId,
      });
    }
  }

  private resolveDueDate(source: 'INTERVIEW_DATE' | 'SUBMISSION_DEADLINE' | 'ASSESSMENT_DEADLINE' | null, facts: ExtractedRecruitmentFacts): { dueAt: Date | null; dueDateConfidence: 'RELIABLE' | 'AMBIGUOUS' | null; originalDateText: string | null } {
    const extraction: DateExtraction | null = source === 'INTERVIEW_DATE' ? facts.interviewDate : source === 'SUBMISSION_DEADLINE' ? facts.submissionDeadline : source === 'ASSESSMENT_DEADLINE' ? facts.assessmentDeadline : null;
    if (!extraction) return { dueAt: null, dueDateConfidence: null, originalDateText: null };
    if (extraction.isAmbiguous || !extraction.normalizedDate) {
      return { dueAt: null, dueDateConfidence: 'AMBIGUOUS', originalDateText: extraction.originalText };
    }
    return { dueAt: new Date(extraction.normalizedDate), dueDateConfidence: 'RELIABLE', originalDateText: extraction.originalText };
  }

  private taskTitleFor(taskType: RecruitmentTaskType): string {
    switch (taskType) {
      case 'CONFIRM_INTERVIEW':
        return 'Confirm your interview';
      case 'SELECT_INTERVIEW_SLOT':
        return 'Choose an interview time';
      case 'PREPARE_INTERVIEW':
        return 'Prepare for your interview';
      case 'UPLOAD_REQUESTED_DOCUMENT':
        return 'Upload requested document(s)';
      case 'SEND_REQUESTED_DOCUMENT':
        return 'Send requested document(s)';
      case 'PROVIDE_INFORMATION':
        return 'Reply with requested information';
      case 'COMPLETE_ASSESSMENT':
        return 'Complete the assessment';
      case 'REVIEW_OFFER':
        return 'Review the offer';
      case 'FOLLOW_UP_AFTER_DATE':
        return 'Follow up';
      case 'MANUAL_REPLY_REVIEW':
        return 'Review this reply manually';
      case 'REAUTHORIZE_INBOX':
        return 'Reauthorize inbox access';
      case 'RECONNECT_MAILBOX':
        return 'Reconnect your mailbox';
    }
  }
}
