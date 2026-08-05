import {
  Application as PrismaApplication,
  TimelineEntry as PrismaTimelineEntry,
  Prisma,
} from '@german-job-engine/database';
import {
  ApplicationLifecycleStatus,
  ActorRole,
  ApplicationChannelType,
} from '@german-job-engine/shared-types';
import { Application } from '../../domain/entities/application.entity';
import { TimelineEntry } from '../../domain/entities/timeline-entry.entity';
import { Timeline } from '../../domain/entities/timeline';
import { ApplicationSnapshot } from '../../domain/value-objects/application-snapshot.vo';
import { ApplicationChannel } from '../../domain/value-objects/application-channel.vo';
import { ApplicationIntelligence } from '../../domain/value-objects/application-intelligence.vo';
import { Probability } from '../../domain/value-objects/probability.vo';
import { DurationEstimate, DurationUnit } from '../../domain/value-objects/duration-estimate.vo';
import { ConfidenceScore } from '../../domain/value-objects/confidence-score.vo';
import { Actor } from '../../domain/value-objects/actor.vo';
import { TransitionReason } from '../../domain/value-objects/transition-reason.vo';
import { CorrelationId } from '../../domain/value-objects/correlation-id.vo';
import { EvidenceReference } from '../../domain/value-objects/evidence-reference.vo';
import { Metadata } from '../../domain/value-objects/metadata.vo';

export type PrismaApplicationWithTimeline = PrismaApplication & { timeline: PrismaTimelineEntry[] };
export type ApplicationPersistenceData = Omit<Prisma.ApplicationUncheckedCreateInput, 'id'>;

/** Bridges the Application aggregate (and its Timeline) to the denormalized Prisma columns. */
export class ApplicationMapper {
  static toDomain(raw: PrismaApplicationWithTimeline): Application {
    const snapshot = ApplicationSnapshot.create({
      jobTitle: raw.snapshotJobTitle,
      companyName: raw.snapshotCompanyName,
      jobLocation: raw.snapshotJobLocation,
      salaryRangeSummary: raw.snapshotSalarySummary,
      capturedAt: raw.snapshotCapturedAt,
    });

    const channel = ApplicationChannel.create(
      raw.channelType as unknown as ApplicationChannelType,
      raw.channelCampaignRef,
    );

    const intelligence = raw.intelComputedBy
      ? ApplicationIntelligence.create({
          replyProbability: raw.intelReplyProbability !== null ? Probability.create(raw.intelReplyProbability) : null,
          interviewProbability:
            raw.intelInterviewProbability !== null ? Probability.create(raw.intelInterviewProbability) : null,
          offerProbability: raw.intelOfferProbability !== null ? Probability.create(raw.intelOfferProbability) : null,
          contractProbability:
            raw.intelContractProbability !== null ? Probability.create(raw.intelContractProbability) : null,
          expectedTimeToReply: ApplicationMapper.toDurationEstimate(
            raw.intelExpectedTimeToReplyAmount,
            raw.intelExpectedTimeToReplyUnit,
          ),
          expectedTimeToInterview: ApplicationMapper.toDurationEstimate(
            raw.intelExpectedTimeToInterviewAmount,
            raw.intelExpectedTimeToInterviewUnit,
          ),
          expectedTimeToContract: ApplicationMapper.toDurationEstimate(
            raw.intelExpectedTimeToContractAmount,
            raw.intelExpectedTimeToContractUnit,
          ),
          confidenceScore: raw.intelConfidenceScore !== null ? ConfidenceScore.create(raw.intelConfidenceScore) : null,
          historicalSuccessScore:
            raw.intelHistoricalSuccessScore !== null ? Probability.create(raw.intelHistoricalSuccessScore) : null,
          riskScore: raw.intelRiskScore !== null ? Probability.create(raw.intelRiskScore) : null,
          decisionExplanation: raw.intelDecisionExplanation,
          recommendationExplanation: raw.intelRecommendationExplanation,
          computedBy: raw.intelComputedBy,
          computedAt: raw.intelComputedAt ?? undefined,
        })
      : null;

    const timeline = Timeline.fromEntries(
      [...raw.timeline]
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
        .map((entry) => ApplicationMapper.toDomainTimelineEntry(entry)),
    );

    return Application.reconstitute(raw.id, {
      candidateId: raw.candidateId,
      jobId: raw.jobId,
      companyId: raw.companyId,
      status: raw.status as unknown as ApplicationLifecycleStatus,
      snapshot,
      channel,
      timeline,
      intelligence,
      submittedAt: raw.submittedAt,
      lastActivityAt: raw.lastActivityAt,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }

  static toPersistence(application: Application): ApplicationPersistenceData {
    const intelligence = application.intelligence;

    return {
      candidateId: application.candidateId,
      jobId: application.jobId,
      companyId: application.companyId,
      status: application.status as unknown as Prisma.ApplicationUncheckedCreateInput['status'],

      snapshotJobTitle: application.snapshot.jobTitle,
      snapshotCompanyName: application.snapshot.companyName,
      snapshotJobLocation: application.snapshot.jobLocation,
      snapshotSalarySummary: application.snapshot.salaryRangeSummary,
      snapshotCapturedAt: application.snapshot.capturedAt,

      channelType: application.channel.type as unknown as Prisma.ApplicationUncheckedCreateInput['channelType'],
      channelCampaignRef: application.channel.campaignRef,

      intelReplyProbability: intelligence?.replyProbability?.value ?? null,
      intelInterviewProbability: intelligence?.interviewProbability?.value ?? null,
      intelOfferProbability: intelligence?.offerProbability?.value ?? null,
      intelContractProbability: intelligence?.contractProbability?.value ?? null,

      intelExpectedTimeToReplyAmount: intelligence?.expectedTimeToReply?.amount ?? null,
      intelExpectedTimeToReplyUnit: intelligence?.expectedTimeToReply?.unit ?? null,
      intelExpectedTimeToInterviewAmount: intelligence?.expectedTimeToInterview?.amount ?? null,
      intelExpectedTimeToInterviewUnit: intelligence?.expectedTimeToInterview?.unit ?? null,
      intelExpectedTimeToContractAmount: intelligence?.expectedTimeToContract?.amount ?? null,
      intelExpectedTimeToContractUnit: intelligence?.expectedTimeToContract?.unit ?? null,

      intelConfidenceScore: intelligence?.confidenceScore?.value ?? null,
      intelHistoricalSuccessScore: intelligence?.historicalSuccessScore?.value ?? null,
      intelRiskScore: intelligence?.riskScore?.value ?? null,
      intelDecisionExplanation: intelligence?.decisionExplanation ?? null,
      intelRecommendationExplanation: intelligence?.recommendationExplanation ?? null,
      intelComputedAt: intelligence?.computedAt ?? null,
      intelComputedBy: intelligence?.computedBy ?? null,

      submittedAt: application.submittedAt,
      lastActivityAt: application.lastActivityAt,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
    };
  }

  /** Every current entry, keyed by its own stable id — persisted via createMany + skipDuplicates
   * so re-saving an aggregate never rewrites or duplicates a transition already on record. */
  static toPersistenceTimelineEntries(application: Application): Prisma.TimelineEntryUncheckedCreateInput[] {
    return application.timeline.entries().map((entry) => ({
      id: entry.id,
      applicationId: application.id,
      timestamp: entry.timestamp,
      actorRole: entry.actor.role as unknown as Prisma.TimelineEntryUncheckedCreateInput['actorRole'],
      actorId: entry.actor.actorId,
      sourceChannelType: entry.source.type as unknown as Prisma.TimelineEntryUncheckedCreateInput['sourceChannelType'],
      sourceCampaignRef: entry.source.campaignRef,
      reasonCode: entry.reason
        ? (entry.reason.code as unknown as Prisma.TimelineEntryUncheckedCreateInput['reasonCode'])
        : null,
      reasonNote: entry.reason?.note ?? null,
      previousState: entry.previousState as unknown as Prisma.TimelineEntryUncheckedCreateInput['previousState'],
      currentState: entry.currentState as unknown as Prisma.TimelineEntryUncheckedCreateInput['currentState'],
      metadata: entry.metadata.entries as Prisma.InputJsonValue,
      correlationId: entry.correlationId.value,
      evidenceType: entry.evidenceReference?.type ?? null,
      evidenceExternalId: entry.evidenceReference?.externalId ?? null,
      evidenceUrl: entry.evidenceReference?.url ?? null,
      confidence: entry.confidence?.value ?? null,
    }));
  }

  private static toDurationEstimate(amount: number | null, unit: string | null): DurationEstimate | null {
    if (amount === null || unit === null) {
      return null;
    }
    return DurationEstimate.create(amount, unit as DurationUnit);
  }

  private static toDomainTimelineEntry(raw: PrismaTimelineEntry): TimelineEntry {
    const actor = Actor.reconstitute(raw.actorRole as unknown as ActorRole, raw.actorId);
    const source = ApplicationChannel.create(raw.sourceChannelType as unknown as ApplicationChannelType, raw.sourceCampaignRef);
    const reason = raw.reasonCode
      ? TransitionReason.create(raw.reasonCode as unknown as Parameters<typeof TransitionReason.create>[0], raw.reasonNote)
      : null;
    const evidenceReference = raw.evidenceType
      ? EvidenceReference.create({
          type: raw.evidenceType,
          externalId: raw.evidenceExternalId ?? '',
          url: raw.evidenceUrl,
        })
      : null;
    const confidence = raw.confidence !== null ? ConfidenceScore.create(raw.confidence) : null;
    const metadata = Metadata.create((raw.metadata as Record<string, string | number | boolean>) ?? {});

    return TimelineEntry.create(raw.id, {
      timestamp: raw.timestamp,
      actor,
      source,
      reason,
      previousState: raw.previousState as unknown as ApplicationLifecycleStatus | null,
      currentState: raw.currentState as unknown as ApplicationLifecycleStatus,
      metadata,
      correlationId: CorrelationId.create(raw.correlationId),
      evidenceReference,
      confidence,
    });
  }
}
