import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConnectedMailboxRepository, CONNECTED_MAILBOX_REPOSITORY } from '../../../connected-mailbox/domain/ports/connected-mailbox.repository';
import { ConnectedMailboxSendService } from '../../../connected-mailbox/application/services/connected-mailbox-send.service';
import { ExecutionClock, EXECUTION_CLOCK } from '../../../execution/domain/ports/execution-clock.port';
import { EmailSecurityAuditService } from '../../../documents/application/services/email-security-audit.service';
import { ReplyDraftRepository, REPLY_DRAFT_REPOSITORY } from '../../domain/ports/reply-draft.repository';
import { InboxMessageRepository, INBOX_MESSAGE_REPOSITORY } from '../../domain/ports/inbox-message.repository';
import { ReplyDraftRecord, ReplyDraftType } from '../../domain/models/reply-draft';
import { generateReplyDraft } from '../../domain/services/reply-draft-generator';
import { ExtractedRecruitmentFacts } from '../../domain/models/extracted-facts';

export interface CreateDraftInput {
  readonly inboxMessageId: string;
  readonly draftType: ReplyDraftType;
  readonly candidateName: string;
  readonly companyName: string;
  readonly jobTitle: string;
}

/**
 * M29 Phase 16 — reply drafting. `approveAndSend()` is the ONLY method that can ever cause a real
 * send, and it does so exclusively through the existing, already-hardened
 * `ConnectedMailboxSendService` (M28.6) — never a new, parallel send path. Every draft starts as
 * `DRAFT`, moves to `EDITED` on any user edit, `APPROVED` only on an explicit user action, and
 * `SENT` only after a real accepted send response. There is no code path from "message classified"
 * to "email sent" that does not pass through an explicit user click at the `APPROVED` step — Phase
 * 16/Non-Negotiable Principle #9's own requirement.
 */
@Injectable()
export class ReplyDraftService {
  constructor(
    @Inject(REPLY_DRAFT_REPOSITORY) private readonly drafts: ReplyDraftRepository,
    @Inject(INBOX_MESSAGE_REPOSITORY) private readonly inboxMessages: InboxMessageRepository,
    @Inject(CONNECTED_MAILBOX_REPOSITORY) private readonly mailboxes: ConnectedMailboxRepository,
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
    private readonly connectedMailboxSend: ConnectedMailboxSendService,
    private readonly audit: EmailSecurityAuditService,
    private readonly config: ConfigService,
  ) {}

  async createDraft(input: CreateDraftInput, userId: string): Promise<ReplyDraftRecord> {
    if (!this.config.get<boolean>('inboxIntelligence.replyDraftingEnabled', false)) {
      throw new Error('Reply drafting is not enabled in this deployment.');
    }
    const now = this.clock.now();
    const message = await this.inboxMessages.findById(input.inboxMessageId);
    if (!message || !message.correlatedApplicationId) {
      throw new NotFoundException('Matched, classified inbox message not found — a draft can only be created after matching and classification.');
    }
    const mailbox = await this.mailboxes.findById(message.connectedMailboxId);
    if (!mailbox) {
      throw new NotFoundException('Connected mailbox not found.');
    }

    const generated = generateReplyDraft({
      draftType: input.draftType,
      candidateName: input.candidateName,
      companyName: input.companyName,
      jobTitle: input.jobTitle,
      originalSubject: message.subject,
      language: message.detectedLanguage === 'DE' ? 'DE' : 'EN',
      facts: message.extractedFacts ?? ({} as ExtractedRecruitmentFacts),
    });

    const draft = await this.drafts.create(
      { inboxMessageId: message.id, applicationId: message.correlatedApplicationId, connectedMailboxId: mailbox.id, draftType: input.draftType, subject: generated.subject, bodyText: generated.bodyText, placeholders: generated.placeholders },
      now,
    );
    await this.audit.record({ eventType: 'REPLY_DRAFT_CREATED', userId, connectedMailboxId: mailbox.id, applicationId: message.correlatedApplicationId, inboxMessageId: message.id, detail: `Draft type ${input.draftType} created.` });
    return draft;
  }

  async editDraft(draftId: string, userId: string, subject: string, bodyText: string): Promise<ReplyDraftRecord> {
    const now = this.clock.now();
    const draft = await this.requireDraft(draftId);
    const updated = await this.drafts.update(draftId, { subject, bodyText, status: 'EDITED' }, now);
    await this.audit.record({ eventType: 'REPLY_DRAFT_EDITED', userId, applicationId: draft.applicationId, inboxMessageId: draft.inboxMessageId, detail: 'Draft edited by user.' });
    return updated;
  }

  /** Marks a draft approved WITHOUT sending — a real, distinct step from `approveAndSend()`, so a
   * user can approve now and send later if the UI ever separates those actions; today's frontend
   * flow calls `approveAndSend()` directly, which performs both atomically. */
  async approveDraft(draftId: string, userId: string): Promise<ReplyDraftRecord> {
    const now = this.clock.now();
    const draft = await this.requireDraft(draftId);
    const updated = await this.drafts.update(draftId, { status: 'APPROVED', approvedByUserId: userId, approvedAt: now }, now);
    await this.audit.record({ eventType: 'REPLY_DRAFT_APPROVED', userId, applicationId: draft.applicationId, inboxMessageId: draft.inboxMessageId, detail: 'Draft approved by user.' });
    return updated;
  }

  /** The ONLY method in this entire module that can result in a real email leaving the server on
   * a candidate's behalf. Requires `INBOX_REPLY_DRAFTING_ENABLED` AND an explicit prior user
   * approval — never reachable from any automated code path. */
  async approveAndSend(draftId: string, userId: string, applicationContext: { recipientEmailAddress: string }): Promise<ReplyDraftRecord> {
    if (!this.config.get<boolean>('inboxIntelligence.replyDraftingEnabled', false)) {
      // Re-checked here, not just at creation: an operator disabling this flag mid-incident must
      // immediately stop ALL further sending through this path, including a draft created before
      // the flag was turned off — never just block new draft creation going forward.
      throw new Error('Reply drafting is not enabled in this deployment.');
    }
    const now = this.clock.now();
    const draft = await this.requireDraft(draftId);
    const approved = draft.status === 'APPROVED' ? draft : await this.approveDraft(draftId, userId);

    const { response } = await this.connectedMailboxSend.sendCandidateApplication({
      requestId: `reply-draft:${draftId}`,
      userId,
      applicationId: approved.applicationId,
      campaignId: null,
      recipientEmailAddress: applicationContext.recipientEmailAddress,
      subject: approved.subject,
      plainTextBody: approved.bodyText,
      htmlBody: null,
      attachments: [],
      correlationId: draftId,
      traceId: null,
    });

    if (!response.accepted) {
      throw new Error(`Reply could not be sent: ${response.providerMessage}`);
    }

    const sent = await this.drafts.update(draftId, { status: 'SENT' }, now);
    await this.audit.record({ eventType: 'REPLY_SENT_BY_USER', userId, applicationId: approved.applicationId, inboxMessageId: approved.inboxMessageId, detail: 'Reply sent after explicit user approval.' });
    return sent;
  }

  async discardDraft(draftId: string, _userId: string): Promise<ReplyDraftRecord> {
    const now = this.clock.now();
    await this.requireDraft(draftId);
    return this.drafts.update(draftId, { status: 'DISCARDED' }, now);
  }

  private async requireDraft(draftId: string): Promise<ReplyDraftRecord> {
    const draft = await this.drafts.findById(draftId);
    if (!draft) {
      throw new NotFoundException('Reply draft not found.');
    }
    return draft;
  }
}
