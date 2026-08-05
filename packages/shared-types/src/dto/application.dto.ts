import { ApplicationLifecycleStatus, ApplicationChannelType, ActorRole } from '../enums';

/**
 * Corrected to match the real backend `ApplicationResponseDto`
 * (apps/api/src/modules/applications/application/dto/application-response.dto.ts) — the previous
 * shape here (`{id, jobListingId, candidateId, status, createdAt}`) predated the real Applications
 * module and didn't match it. Verified field-for-field during Milestone 24's research pass.
 */
export interface ApplicationSnapshotDto {
  jobTitle: string;
  companyName: string;
  jobLocation: string;
  salaryRangeSummary: string | null;
  capturedAt: string;
}

export interface ApplicationChannelDto {
  type: ApplicationChannelType;
  /** A real, but loose and unvalidated, free-text reference — never checked against a real
   * campaign id server-side. Never present as a verified "this application belongs to campaign
   * X" link (docs/campaign-workspace/03-integration-points.md). */
  campaignRef: string | null;
}

export interface ApplicationTimeEstimateDto {
  amount: number;
  unit: string;
}

/** Reserved — mirrors `CampaignIntelligenceDto`'s status: a real DTO shape with no confirmed
 * production writer verified as of Milestone 24. Every field must be treated as possibly `null`
 * and never assumed populated. */
export interface ApplicationIntelligenceDto {
  replyProbability: number | null;
  interviewProbability: number | null;
  offerProbability: number | null;
  contractProbability: number | null;
  expectedTimeToReply: ApplicationTimeEstimateDto | null;
  expectedTimeToInterview: ApplicationTimeEstimateDto | null;
  expectedTimeToContract: ApplicationTimeEstimateDto | null;
  confidenceScore: number | null;
  historicalSuccessScore: number | null;
  riskScore: number | null;
  decisionExplanation: string | null;
  recommendationExplanation: string | null;
  computedAt: string;
  computedBy: string;
}

export interface ApplicationDto {
  id: string;
  candidateId: string;
  jobId: string;
  companyId: string;
  status: ApplicationLifecycleStatus;
  snapshot: ApplicationSnapshotDto;
  channel: ApplicationChannelDto;
  intelligence: ApplicationIntelligenceDto | null;
  submittedAt: string | null;
  lastActivityAt: string;
  isTerminal: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationActorDto {
  role: ActorRole;
  actorId: string | null;
}

export interface ApplicationEvidenceReferenceDto {
  type: string;
  externalId: string;
  url: string | null;
}

export interface ApplicationTransitionReasonDto {
  code: string;
  note: string | null;
}

/** `GET /applications/:id/timeline` — a real, structured per-application transition ledger. Note:
 * unlike `CampaignTimelineEntryDto`, there is no `aiExplanation` field here — only `reason.note`. */
export interface ApplicationTimelineEntryDto {
  id: string;
  timestamp: string;
  actor: ApplicationActorDto;
  source: ApplicationChannelDto;
  reason: ApplicationTransitionReasonDto | null;
  previousState: ApplicationLifecycleStatus | null;
  currentState: ApplicationLifecycleStatus;
  metadata: Record<string, string | number | boolean>;
  correlationId: string;
  evidenceReference: ApplicationEvidenceReferenceDto | null;
  /** Real DTO field; treat as possibly `null` like every other reserved score in this codebase. */
  confidence: number | null;
}

export interface PaginatedApplicationsDto {
  items: ApplicationDto[];
  total: number;
  page: number;
  limit: number;
}
