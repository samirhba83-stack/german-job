import { CorrelationStatus, ReplyPrimaryCategory, ReplySecondaryLabel, ClassificationSource, InboxMessageReviewStatus } from '../enums/inbox-intelligence.enum';
import { ProposedApplicationAction, ApplicationTransitionProposalStatus } from '../enums/inbox-intelligence.enum';
import { ReplyDraftType, ReplyDraftStatus, NotificationKind } from '../enums/inbox-intelligence.enum';

/** `POST /inbox/consent/start` — same shape/redirect pattern as `StartMailboxConnectionResponseDto`. */
export interface StartInboxConsentResponseDto {
  authorizationUrl: string;
}

export interface ExtractedRecruitmentFactsDto {
  interviewDate: DateExtractionDto | null;
  interviewTime: string | null;
  timeZone: string | null;
  interviewType: 'IN_PERSON' | 'VIDEO_CALL' | 'PHONE_CALL' | 'UNSPECIFIED' | null;
  physicalAddress: string | null;
  videoMeetingLink: string | null;
  contactPersonName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  requestedDocuments: string[];
  submissionDeadline: DateExtractionDto | null;
  assessmentDeadline: DateExtractionDto | null;
  proposedStartDate: DateExtractionDto | null;
  compensationMention: string | null;
  contractTypeMention: string | null;
  requiredReplyAction: string | null;
}

export interface DateExtractionDto {
  originalText: string;
  normalizedDate: string | null;
  isAmbiguous: boolean;
  ambiguityReason: string | null;
}

export interface NextActionRecommendationDto {
  type: string;
  description: string;
  basedOnEvidence: string;
}

/** `GET /inbox/messages` row shape — never carries the full raw message body, only the bounded
 * `sanitizedExcerpt` already stored (M29 Non-Negotiable Principle: never store/expose full body). */
export interface InboxMessageDto {
  id: string;
  providerThreadId: string | null;
  fromAddress: string;
  subject: string;
  receivedAt: string;
  correlationStatus: CorrelationStatus;
  correlatedApplicationId: string | null;
  correlatedCampaignId: string | null;
  sanitizedExcerpt: string | null;
  detectedLanguage: string | null;
  primaryCategory: ReplyPrimaryCategory | null;
  secondaryLabels: ReplySecondaryLabel[];
  classificationConfidence: number | null;
  classificationSource: ClassificationSource | null;
  extractedFacts: ExtractedRecruitmentFactsDto | null;
  reviewStatus: InboxMessageReviewStatus;
  recommendedNextAction: NextActionRecommendationDto | null;
  createdAt: string;
}

export interface InboxMessageCorrectionDto {
  id: string;
  inboxMessageId: string;
  correctionType: 'CLASSIFICATION' | 'EXTRACTED_FACTS' | 'CORRELATION' | 'UNRELATED_MARK';
  originalValue: Record<string, unknown>;
  correctedValue: Record<string, unknown>;
  correctedByUserId: string;
  reason: string | null;
  createdAt: string;
}

export interface ApplicationTransitionProposalDto {
  id: string;
  inboxMessageId: string;
  applicationId: string;
  proposedAction: ProposedApplicationAction;
  classification: ReplyPrimaryCategory | null;
  confidence: number | null;
  evidence: Record<string, unknown> | null;
  actorType: string;
  status: ApplicationTransitionProposalStatus;
  confirmedByUserId: string | null;
  confirmedAt: string | null;
  rejectedByUserId: string | null;
  rejectedAt: string | null;
  createdAt: string;
}

export interface ReplyDraftPlaceholderDto {
  label: string;
  filled: boolean;
}

export interface ReplyDraftDto {
  id: string;
  inboxMessageId: string;
  draftType: ReplyDraftType;
  subject: string;
  bodyText: string;
  placeholders: ReplyDraftPlaceholderDto[];
  status: ReplyDraftStatus;
  approvedByUserId: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** `GET /inbox/messages/:id` — the full detail view: the message plus every real, related record. */
export interface InboxMessageDetailDto extends InboxMessageDto {
  corrections: InboxMessageCorrectionDto[];
  transitionProposals: ApplicationTransitionProposalDto[];
  drafts: ReplyDraftDto[];
}

export interface CorrectClassificationRequestDto {
  category: ReplyPrimaryCategory;
  reason?: string;
}

export interface CorrectFactsRequestDto {
  facts: Record<string, unknown>;
  reason?: string;
}

export interface ConfirmApplicationMatchRequestDto {
  applicationId: string;
  campaignId?: string;
}

export interface CreateReplyDraftRequestDto {
  draftType: ReplyDraftType;
  candidateName: string;
  companyName: string;
  jobTitle: string;
}

export interface EditReplyDraftRequestDto {
  subject: string;
  bodyText: string;
}

export interface ApproveAndSendDraftRequestDto {
  recipientEmailAddress: string;
}

export interface NotificationDto {
  id: string;
  kind: NotificationKind;
  relatedInboxMessageId: string | null;
  relatedApplicationId: string | null;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPreferenceDto {
  userId: string;
  interviewInvitationEnabled: boolean;
  offerOrAcceptanceEnabled: boolean;
  rejectionEnabled: boolean;
  documentsRequestedEnabled: boolean;
  deadlineApproachingEnabled: boolean;
  assessmentInvitationEnabled: boolean;
  inboxConnectionIssuesEnabled: boolean;
  ambiguousReplyReviewEnabled: boolean;
}
