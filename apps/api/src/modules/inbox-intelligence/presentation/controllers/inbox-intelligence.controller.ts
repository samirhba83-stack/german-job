import { Body, Controller, Delete, Get, Inject, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../../auth/application/dto/jwt-payload.interface';
import { ConnectedMailboxRepository, CONNECTED_MAILBOX_REPOSITORY } from '../../../connected-mailbox/domain/ports/connected-mailbox.repository';
import { InboxConsentService } from '../../application/services/inbox-consent.service';
import { InboxMessageRepository, INBOX_MESSAGE_REPOSITORY } from '../../domain/ports/inbox-message.repository';
import { InboxMessageCorrectionRepository, INBOX_MESSAGE_CORRECTION_REPOSITORY } from '../../domain/ports/inbox-message-correction.repository';
import { ApplicationTransitionProposalRepository, APPLICATION_TRANSITION_PROPOSAL_REPOSITORY } from '../../domain/ports/application-transition-proposal.repository';
import { ReplyDraftRepository, REPLY_DRAFT_REPOSITORY } from '../../domain/ports/reply-draft.repository';
import { InboxCorrectionService } from '../../application/services/inbox-correction.service';
import { ApplicationTransitionProposalService } from '../../application/services/application-transition-proposal.service';
import { ReplyDraftService } from '../../application/services/reply-draft.service';
import { NotificationService } from '../../application/services/notification.service';
import { recommendNextAction } from '../../domain/services/next-action-engine';
import { InboxMessageRecord } from '../../domain/models/inbox-message';

class CorrectClassificationDto {
  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

class CorrectFactsDto {
  @IsObject()
  facts!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  reason?: string;
}

class ReasonDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

class ConfirmApplicationMatchDto {
  @IsString()
  @IsNotEmpty()
  applicationId!: string;

  @IsOptional()
  @IsString()
  campaignId?: string;
}

class CreateDraftDto {
  @IsIn(['INTERVIEW_ACCEPTANCE', 'REQUEST_ALTERNATIVE_TIME', 'DOCUMENT_SUBMISSION_ACKNOWLEDGMENT', 'INFORMATION_RESPONSE', 'POLITE_FOLLOWUP', 'OFFER_ACKNOWLEDGMENT', 'REJECTION_ACKNOWLEDGMENT'])
  draftType!:
    | 'INTERVIEW_ACCEPTANCE'
    | 'REQUEST_ALTERNATIVE_TIME'
    | 'DOCUMENT_SUBMISSION_ACKNOWLEDGMENT'
    | 'INFORMATION_RESPONSE'
    | 'POLITE_FOLLOWUP'
    | 'OFFER_ACKNOWLEDGMENT'
    | 'REJECTION_ACKNOWLEDGMENT';

  @IsString()
  @IsNotEmpty()
  candidateName!: string;

  @IsString()
  @IsNotEmpty()
  companyName!: string;

  @IsString()
  @IsNotEmpty()
  jobTitle!: string;
}

class EditDraftDto {
  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsString()
  @IsNotEmpty()
  bodyText!: string;
}

class ApproveAndSendDraftDto {
  @IsString()
  @IsNotEmpty()
  recipientEmailAddress!: string;
}

/** Never exposes raw message content beyond the bounded, already-sanitized excerpt already stored
 * — this controller has no code path that fetches a full raw body on demand (Phase 17: "each
 * reply detail must show a relevant message excerpt," never the full message). */
function toMessageResponse(message: InboxMessageRecord) {
  return {
    id: message.id,
    providerThreadId: message.providerThreadId,
    fromAddress: message.fromAddress,
    subject: message.subject,
    receivedAt: message.receivedAt.toISOString(),
    correlationStatus: message.correlationStatus,
    correlatedApplicationId: message.correlatedApplicationId,
    correlatedCampaignId: message.correlatedCampaignId,
    sanitizedExcerpt: message.sanitizedExcerpt,
    detectedLanguage: message.detectedLanguage,
    primaryCategory: message.primaryCategory,
    secondaryLabels: message.secondaryLabels,
    classificationConfidence: message.classificationConfidence,
    classificationSource: message.classificationSource,
    extractedFacts: message.extractedFacts,
    reviewStatus: message.reviewStatus,
    recommendedNextAction: message.primaryCategory && message.extractedFacts ? recommendNextAction(message.primaryCategory, message.extractedFacts) : null,
    createdAt: message.createdAt.toISOString(),
  };
}

/**
 * M29 Phase 17 — the real Inbox Intelligence workspace API. Every route requires the verified
 * JWT; every query is scoped to the authenticated user's own connected mailbox(es) — never a raw
 * id lookup a different user could substitute their own id into (Phase 21: "cross-user message
 * access").
 */
@ApiTags('inbox-intelligence')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inbox')
export class InboxIntelligenceController {
  constructor(
    @Inject(CONNECTED_MAILBOX_REPOSITORY) private readonly mailboxes: ConnectedMailboxRepository,
    @Inject(INBOX_MESSAGE_REPOSITORY) private readonly inboxMessages: InboxMessageRepository,
    @Inject(INBOX_MESSAGE_CORRECTION_REPOSITORY) private readonly corrections: InboxMessageCorrectionRepository,
    @Inject(APPLICATION_TRANSITION_PROPOSAL_REPOSITORY) private readonly proposals: ApplicationTransitionProposalRepository,
    @Inject(REPLY_DRAFT_REPOSITORY) private readonly replyDrafts: ReplyDraftRepository,
    private readonly consentService: InboxConsentService,
    private readonly correctionService: InboxCorrectionService,
    private readonly transitionProposalService: ApplicationTransitionProposalService,
    private readonly draftService: ReplyDraftService,
    private readonly notificationService: NotificationService,
  ) {}

  @Post('consent/start')
  async startConsent(@CurrentUser() user: JwtPayload) {
    return this.consentService.startInboxUpgrade(user.sub);
  }

  @Delete('consent')
  async revokeConsent(@CurrentUser() user: JwtPayload) {
    const mailbox = await this.mailboxes.findActiveByUserId(user.sub);
    if (mailbox) {
      await this.consentService.revokeInboxAccess(user.sub, mailbox.id);
    }
    return { success: true };
  }

  @Get('messages')
  async listMessages(@CurrentUser() user: JwtPayload, @Query('reviewStatus') reviewStatus?: string, @Query('correlationStatus') correlationStatus?: string, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    const messages = await this.inboxMessages.list({ userId: user.sub, reviewStatus, correlationStatus }, limit ? Math.min(Number(limit), 200) : 50, offset ? Number(offset) : 0);
    return messages.map(toMessageResponse);
  }

  @Get('messages/:id')
  async getMessage(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const message = await this.requireOwnedMessage(id, user.sub);
    const [messageCorrections, transitionProposals, drafts] = await Promise.all([
      this.corrections.listByInboxMessageId(id),
      this.proposals.listByApplicationId(message.correlatedApplicationId ?? '__none__'),
      this.replyDrafts.listByInboxMessageId(id),
    ]);
    return {
      ...toMessageResponse(message),
      corrections: messageCorrections,
      transitionProposals: transitionProposals.filter((p) => p.inboxMessageId === id),
      drafts,
    };
  }

  @Post('messages/:id/corrections/classification')
  async correctClassification(@Param('id') id: string, @Body() dto: CorrectClassificationDto, @CurrentUser() user: JwtPayload) {
    await this.requireOwnedMessage(id, user.sub);
    const updated = await this.correctionService.correctClassification(id, user.sub, dto.category as never, dto.reason ?? null);
    return toMessageResponse(updated);
  }

  @Post('messages/:id/corrections/facts')
  async correctFacts(@Param('id') id: string, @Body() dto: CorrectFactsDto, @CurrentUser() user: JwtPayload) {
    await this.requireOwnedMessage(id, user.sub);
    const updated = await this.correctionService.correctExtractedFacts(id, user.sub, dto.facts as never, dto.reason ?? null);
    return toMessageResponse(updated);
  }

  @Post('messages/:id/mark-unrelated')
  async markUnrelated(@Param('id') id: string, @Body() dto: ReasonDto, @CurrentUser() user: JwtPayload) {
    await this.requireOwnedMessage(id, user.sub);
    const updated = await this.correctionService.markUnrelated(id, user.sub, dto.reason ?? null);
    return toMessageResponse(updated);
  }

  @Post('messages/:id/confirm-application-match')
  async confirmApplicationMatch(@Param('id') id: string, @Body() dto: ConfirmApplicationMatchDto, @CurrentUser() user: JwtPayload) {
    await this.requireOwnedMessage(id, user.sub);
    const updated = await this.correctionService.confirmApplicationMatch(id, user.sub, dto.applicationId, dto.campaignId ?? null);
    return toMessageResponse(updated);
  }

  @Post('transition-proposals/:id/confirm')
  async confirmProposal(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.transitionProposalService.confirmProposal(id, user.sub);
  }

  @Post('transition-proposals/:id/reject')
  async rejectProposal(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.transitionProposalService.rejectProposal(id, user.sub);
  }

  @Post('messages/:id/drafts')
  async createDraft(@Param('id') id: string, @Body() dto: CreateDraftDto, @CurrentUser() user: JwtPayload) {
    await this.requireOwnedMessage(id, user.sub);
    return this.draftService.createDraft({ inboxMessageId: id, draftType: dto.draftType, candidateName: dto.candidateName, companyName: dto.companyName, jobTitle: dto.jobTitle }, user.sub);
  }

  @Patch('drafts/:id')
  async editDraft(@Param('id') id: string, @Body() dto: EditDraftDto, @CurrentUser() user: JwtPayload) {
    return this.draftService.editDraft(id, user.sub, dto.subject, dto.bodyText);
  }

  @Post('drafts/:id/approve-and-send')
  async approveAndSendDraft(@Param('id') id: string, @Body() dto: ApproveAndSendDraftDto, @CurrentUser() user: JwtPayload) {
    return this.draftService.approveAndSend(id, user.sub, { recipientEmailAddress: dto.recipientEmailAddress });
  }

  @Post('drafts/:id/discard')
  async discardDraft(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.draftService.discardDraft(id, user.sub);
  }

  @Get('notifications')
  async listNotifications(@CurrentUser() user: JwtPayload, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.notificationService.listForUser(user.sub, limit ? Math.min(Number(limit), 200) : 50, offset ? Number(offset) : 0);
  }

  @Post('notifications/:id/read')
  async markNotificationRead(@Param('id') id: string) {
    await this.notificationService.markRead(id);
    return { success: true };
  }

  @Get('notification-preferences')
  async getNotificationPreferences(@CurrentUser() user: JwtPayload) {
    return this.notificationService.getPreferences(user.sub);
  }

  @Patch('notification-preferences')
  async updateNotificationPreferences(@Body() patch: Record<string, boolean>, @CurrentUser() user: JwtPayload) {
    return this.notificationService.updatePreferences(user.sub, patch as never);
  }

  /** Real cross-user-access defense (Phase 21) — every message lookup is scoped through the
   * OWNING mailbox's `userId`, never a bare id lookup a different authenticated user could reuse. */
  private async requireOwnedMessage(id: string, userId: string): Promise<InboxMessageRecord> {
    const message = await this.inboxMessages.findById(id);
    if (!message) {
      throw new NotFoundException('Inbox message not found.');
    }
    const mailbox = await this.mailboxes.findById(message.connectedMailboxId);
    if (!mailbox || mailbox.userId !== userId) {
      // Never reveal whether the id belongs to someone else — same "not found" shape either way.
      throw new NotFoundException('Inbox message not found.');
    }
    return message;
  }
}
