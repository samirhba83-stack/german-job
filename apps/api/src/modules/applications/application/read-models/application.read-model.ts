import {
  ApplicationLifecycleStatus,
  ActorRole,
  ApplicationChannelType,
  TransitionReasonCode,
} from '@german-job-engine/shared-types';

export interface ActorReadModel {
  role: ActorRole;
  actorId: string | null;
}

export interface ChannelReadModel {
  type: ApplicationChannelType;
  campaignRef: string | null;
}

export interface SnapshotReadModel {
  jobTitle: string;
  companyName: string;
  jobLocation: string;
  salaryRangeSummary: string | null;
  capturedAt: Date;
}

export interface IntelligenceReadModel {
  replyProbability: number | null;
  interviewProbability: number | null;
  offerProbability: number | null;
  contractProbability: number | null;
  expectedTimeToReply: { amount: number; unit: string } | null;
  expectedTimeToInterview: { amount: number; unit: string } | null;
  expectedTimeToContract: { amount: number; unit: string } | null;
  confidenceScore: number | null;
  historicalSuccessScore: number | null;
  riskScore: number | null;
  decisionExplanation: string | null;
  recommendationExplanation: string | null;
  computedAt: Date;
  computedBy: string;
}

export interface ApplicationReadModel {
  id: string;
  candidateId: string;
  jobId: string;
  companyId: string;
  status: ApplicationLifecycleStatus;
  snapshot: SnapshotReadModel;
  channel: ChannelReadModel;
  intelligence: IntelligenceReadModel | null;
  submittedAt: Date | null;
  lastActivityAt: Date;
  isTerminal: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TimelineEntryReadModel {
  id: string;
  timestamp: Date;
  actor: ActorReadModel;
  source: ChannelReadModel;
  reason: { code: TransitionReasonCode; note: string | null } | null;
  previousState: ApplicationLifecycleStatus | null;
  currentState: ApplicationLifecycleStatus;
  metadata: Record<string, string | number | boolean>;
  correlationId: string;
  evidenceReference: { type: string; externalId: string; url: string | null } | null;
  confidence: number | null;
}

export interface PaginatedApplicationsReadModel {
  items: ApplicationReadModel[];
  total: number;
  page: number;
  limit: number;
}

/**
 * The narrative, human-readable view over the Timeline — "Application History" in the
 * Ubiquitous Language — distinct from GetTimeline's raw structured ledger.
 */
export interface ApplicationHistoryEntryReadModel {
  timestamp: Date;
  summary: string;
  actor: ActorReadModel;
}
