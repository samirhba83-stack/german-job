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
import { ReplyPrimaryCategory, ReplySecondaryLabel } from '../../domain/models/reply-taxonomy';
import { InboxAccessTokenService } from './inbox-access-token.service';
import { ApplicationTransitionProposalService } from './application-transition-proposal.service';
import { NotificationService } from './notification.service';
import { NotificationKind } from '../../domain/models/notification';

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

    await this.recordFollowupPauseIfWarranted(mailbox.userId, correlation.correlatedCampaignId, correlation.correlatedApplicationId, created.id, finalCategory, finalSecondaryLabels);

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
   * M29 Phase 14 — "stop follow-ups after a relevant human reply/rejection/interview invitation."
   * Deliberately lives here (not a separate `CompanyReplied` EventBus subscriber) because the real
   * campaign id is only available from THIS message's own correlation
   * (`ConnectedMailboxSendAttempt.campaignId`, captured at send time) — `Application` itself has
   * no `campaignId` back-reference (a pre-existing, confirmed fact from the M23 audit), so a
   * downstream subscriber reacting to `CompanyReplied` alone could never reliably re-derive which
   * campaign to pause.
   *
   * Scoped honestly: this milestone records a real, auditable `CAMPAIGN_FOLLOWUP_PAUSED` event —
   * the durable signal an operator or a future automated dispatcher can act on — but does NOT
   * itself mutate any `CampaignTarget` status. `CampaignTarget.markSkipped()` is designed for
   * PRE-dispatch skipping (an unconditional status overwrite with no "already dispatched" guard);
   * calling it after a target has already been successfully dispatched would incorrectly rewrite
   * genuine send history, not express "stop future follow-ups to this one." Building a real,
   * dispatch-history-safe exclusion command belongs to the campaigns module's own bounded context
   * and would need that module's dispatch/retry engine investigated in full — deliberately not
   * guessed at here against a live, already-approved production execution path (M26).
   */
  private async recordFollowupPauseIfWarranted(
    userId: string,
    campaignId: string | null,
    applicationId: string | null,
    inboxMessageId: string,
    category: ReplyPrimaryCategory,
    secondaryLabels: ReadonlyArray<ReplySecondaryLabel>,
  ): Promise<void> {
    if (!campaignId) return;
    const isRelevantHumanSignal = secondaryLabels.includes('HUMAN_REPLY') && category !== 'SPAM_OR_UNRELATED' && category !== 'NEEDS_MANUAL_REVIEW' && category !== 'UNKNOWN';
    if (!isRelevantHumanSignal) return;

    await this.audit.record({
      eventType: 'CAMPAIGN_FOLLOWUP_PAUSED',
      userId,
      campaignId,
      applicationId: applicationId ?? undefined,
      inboxMessageId,
      detail: `A real human reply (${category}) was received — future automated follow-up for this application should be avoided. No CampaignTarget mutation performed (see this method's own doc comment for why).`,
    });
  }
}
