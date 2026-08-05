import {
  Campaign as PrismaCampaign,
  CampaignTarget as PrismaCampaignTarget,
  DispatchAttempt as PrismaDispatchAttempt,
  Batch as PrismaBatch,
  CompanyMemoryEntry as PrismaCompanyMemoryEntry,
  CampaignTimelineEntry as PrismaCampaignTimelineEntry,
  Prisma,
} from '@german-job-engine/database';
import {
  CampaignStatus,
  CampaignStrategyType,
  CampaignTargetStatus,
  BatchStatus,
  DispatchOutcome,
  CampaignActorRole,
  CampaignReasonCode,
  CampaignOutcomeGoal,
  TrendDirection,
  Weekday,
} from '@german-job-engine/shared-types';
import { Campaign } from '../../domain/entities/campaign.entity';
import { CampaignTarget } from '../../domain/entities/campaign-target.entity';
import { DispatchAttempt } from '../../domain/entities/dispatch-attempt.entity';
import { Batch } from '../../domain/entities/batch.entity';
import { CompanyMemoryEntry } from '../../domain/entities/company-memory-entry.entity';
import { CampaignTimelineEntry } from '../../domain/entities/campaign-timeline-entry.entity';
import { Timeline } from '../../domain/entities/timeline';
import { CampaignName } from '../../domain/value-objects/campaign-name.vo';
import { CampaignGoal } from '../../domain/value-objects/campaign-goal.vo';
import { CampaignStrategyProfile } from '../../domain/value-objects/campaign-strategy-profile.vo';
import { SmartBatchPlan } from '../../domain/value-objects/smart-batch-plan.vo';
import { ExecutionWindow } from '../../domain/value-objects/execution-window.vo';
import { RateLimitProfile } from '../../domain/value-objects/rate-limit-profile.vo';
import { AdaptiveSpeedProfile } from '../../domain/value-objects/adaptive-speed-profile.vo';
import { CampaignHealth } from '../../domain/value-objects/campaign-health.vo';
import { CampaignIntelligence } from '../../domain/value-objects/campaign-intelligence.vo';
import { SmartResumeSelection } from '../../domain/value-objects/smart-resume-selection.vo';
import { SmartMotivationLetterSelection } from '../../domain/value-objects/smart-motivation-letter-selection.vo';
import { Probability } from '../../domain/value-objects/probability.vo';
import { Actor } from '../../domain/value-objects/actor.vo';
import { CorrelationId } from '../../domain/value-objects/correlation-id.vo';
import { CampaignReason } from '../../domain/value-objects/campaign-reason.vo';
import { Metadata } from '../../domain/value-objects/metadata.vo';
import { EvidenceReference } from '../../domain/value-objects/evidence-reference.vo';
import { CooldownPeriod } from '../../domain/value-objects/cooldown-period.vo';
import { Checkpoint } from '../../domain/value-objects/checkpoint.vo';

export type PrismaCampaignWithRelations = PrismaCampaign & {
  targets: (PrismaCampaignTarget & { dispatchAttempts: PrismaDispatchAttempt[] })[];
  batches: PrismaBatch[];
  companyMemory: PrismaCompanyMemoryEntry[];
  timeline: PrismaCampaignTimelineEntry[];
};

export type CampaignPersistenceData = Omit<Prisma.CampaignUncheckedCreateInput, 'id'>;

/** Bridges the Campaign aggregate (and its owned collections) to the denormalized Prisma columns. */
export class CampaignMapper {
  static toDomain(raw: PrismaCampaignWithRelations): Campaign {
    const strategy = CampaignStrategyProfile.create(
      raw.strategyType as unknown as CampaignStrategyType,
      raw.strategyParameters ? Metadata.create(raw.strategyParameters as Record<string, string | number | boolean>) : undefined,
    );

    const goal = CampaignGoal.create({
      targetApplicationCount: raw.goalTargetApplicationCount,
      desiredOutcome: raw.goalDesiredOutcome as unknown as CampaignOutcomeGoal,
      deadline: raw.goalDeadline,
    });

    const batchPlan = SmartBatchPlan.create({
      baseBatchSize: raw.batchPlanBaseSize,
      minBatchSize: raw.batchPlanMinSize,
      maxBatchSize: raw.batchPlanMaxSize,
      adaptive: raw.batchPlanAdaptive,
      expansionIncrement: raw.batchPlanExpansionIncrement,
    });

    const executionWindow = ExecutionWindow.create({
      allowedWeekdays: raw.executionWindowWeekdays as unknown as Weekday[],
      dailyStartHour: raw.executionWindowDailyStartHour,
      dailyEndHour: raw.executionWindowDailyEndHour,
      timezone: raw.executionWindowTimezone,
      respectHolidays: raw.executionWindowRespectHolidays,
    });

    const rateLimitProfile = RateLimitProfile.create({
      maxPerDay: raw.rateLimitMaxPerDay,
      maxPerHour: raw.rateLimitMaxPerHour,
      maxPerCompanyPerWindow: raw.rateLimitMaxPerCompanyPerWindow,
    });

    const adaptiveSpeedProfile = raw.adaptiveComputedBy
      ? AdaptiveSpeedProfile.create({
          replyRateFactor: raw.adaptiveReplyRateFactor,
          bounceRateFactor: raw.adaptiveBounceRateFactor,
          timeOfDayFactor: raw.adaptiveTimeOfDayFactor,
          weekdayFactor: raw.adaptiveWeekdayFactor,
          germanHolidayFactor: raw.adaptiveGermanHolidayFactor,
          companyWorkingHoursFactor: raw.adaptiveCompanyWorkingHoursFactor,
          campaignHealthFactor: raw.adaptiveCampaignHealthFactor,
          companyFatigueFactor: raw.adaptiveCompanyFatigueFactor,
          userReputationFactor: raw.adaptiveUserReputationFactor,
          riskScoreFactor: raw.adaptiveRiskScoreFactor,
          computedBy: raw.adaptiveComputedBy,
          computedAt: raw.adaptiveComputedAt ?? undefined,
        })
      : null;

    const checkpoint = raw.checkpointLastCompletedBatchId
      ? Checkpoint.create({
          lastCompletedBatchId: raw.checkpointLastCompletedBatchId,
          cursorPosition: raw.checkpointCursorPosition ?? 0,
          savedAt: raw.checkpointSavedAt ?? undefined,
        })
      : null;

    const cooldown =
      raw.cooldownStartedAt && raw.cooldownUntil && raw.cooldownReason
        ? CooldownPeriod.create({
            startedAt: raw.cooldownStartedAt,
            until: raw.cooldownUntil,
            reason: raw.cooldownReason as unknown as CampaignReasonCode,
          })
        : null;

    const health = raw.healthComputedBy
      ? CampaignHealth.create({
          healthScore: raw.healthScore !== null ? Probability.create(raw.healthScore) : null,
          riskScore: raw.riskScore !== null ? Probability.create(raw.riskScore) : null,
          progressScore: raw.progressScore !== null ? Probability.create(raw.progressScore) : null,
          successTrend: raw.successTrend as unknown as TrendDirection | null,
          replyTrend: raw.replyTrend as unknown as TrendDirection | null,
          performanceTrend: raw.performanceTrend as unknown as TrendDirection | null,
          computedBy: raw.healthComputedBy,
          computedAt: raw.healthComputedAt ?? undefined,
        })
      : null;

    const intelligence = raw.intelComputedBy
      ? CampaignIntelligence.create({
          bestSendTime: raw.intelBestSendTime,
          bestBatchSize: raw.intelBestBatchSize,
          bestCompanyOrder: raw.intelBestCompanyOrder.length > 0 ? raw.intelBestCompanyOrder : null,
          bestResumeSelection: raw.intelBestResumeDocumentId
            ? SmartResumeSelection.assign({
                documentId: raw.intelBestResumeDocumentId,
                confidence: raw.intelBestResumeConfidence !== null ? Probability.create(raw.intelBestResumeConfidence) : null,
                explanation: raw.intelBestResumeExplanation,
                selectedBy: raw.intelBestResumeSelectedBy ?? 'unknown',
                selectedAt: raw.intelBestResumeSelectedAt ?? undefined,
              })
            : null,
          bestMotivationLetterSelection: raw.intelBestMotivationDocumentId
            ? SmartMotivationLetterSelection.assign({
                documentId: raw.intelBestMotivationDocumentId,
                confidence:
                  raw.intelBestMotivationConfidence !== null ? Probability.create(raw.intelBestMotivationConfidence) : null,
                explanation: raw.intelBestMotivationExplanation,
                selectedBy: raw.intelBestMotivationSelectedBy ?? 'unknown',
                selectedAt: raw.intelBestMotivationSelectedAt ?? undefined,
              })
            : null,
          replyPrediction: raw.intelReplyPrediction !== null ? Probability.create(raw.intelReplyPrediction) : null,
          interviewPrediction: raw.intelInterviewPrediction !== null ? Probability.create(raw.intelInterviewPrediction) : null,
          offerPrediction: raw.intelOfferPrediction !== null ? Probability.create(raw.intelOfferPrediction) : null,
          contractPrediction: raw.intelContractPrediction !== null ? Probability.create(raw.intelContractPrediction) : null,
          riskPrediction: raw.intelRiskPrediction !== null ? Probability.create(raw.intelRiskPrediction) : null,
          decisionExplanation: raw.intelDecisionExplanation,
          recommendationExplanation: raw.intelRecommendationExplanation,
          computedBy: raw.intelComputedBy,
          computedAt: raw.intelComputedAt ?? undefined,
        })
      : null;

    const targets = [...raw.targets]
      .sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime())
      .map((target) => CampaignMapper.toDomainTarget(target));
    const batches = [...raw.batches]
      .sort((a, b) => (a.startedAt?.getTime() ?? 0) - (b.startedAt?.getTime() ?? 0))
      .map((batch) => CampaignMapper.toDomainBatch(batch));
    const companyMemory = raw.companyMemory.map((entry) => CampaignMapper.toDomainCompanyMemory(entry));
    const timeline = Timeline.fromEntries(
      [...raw.timeline]
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
        .map((entry) => CampaignMapper.toDomainTimelineEntry(entry)),
    );

    return Campaign.reconstitute(
      raw.id,
      {
        ownerId: raw.ownerId,
        name: CampaignName.create(raw.name),
        status: raw.status as unknown as CampaignStatus,
        strategy,
        goal,
        batchPlan,
        executionWindow,
        rateLimitProfile,
        adaptiveSpeedProfile,
        targets,
        batches,
        companyMemory,
        checkpoint,
        cooldown,
        timeline,
        health,
        intelligence,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
        startedAt: raw.startedAt,
        completedAt: raw.completedAt,
      },
      raw.version,
    );
  }

  static toPersistence(campaign: Campaign): CampaignPersistenceData {
    const intelligence = campaign.intelligence;
    const adaptive = campaign.adaptiveSpeedProfile;
    const health = campaign.health;

    return {
      ownerId: campaign.ownerId,
      name: campaign.name.value,
      status: campaign.status as unknown as Prisma.CampaignUncheckedCreateInput['status'],
      strategyType: campaign.strategy.type as unknown as Prisma.CampaignUncheckedCreateInput['strategyType'],
      strategyParameters: campaign.strategy.parameters.isEmpty()
        ? Prisma.JsonNull
        : (campaign.strategy.parameters.entries as Prisma.InputJsonValue),

      goalTargetApplicationCount: campaign.goal.targetApplicationCount,
      goalDesiredOutcome: campaign.goal.desiredOutcome as unknown as Prisma.CampaignUncheckedCreateInput['goalDesiredOutcome'],
      goalDeadline: campaign.goal.deadline,

      batchPlanBaseSize: campaign.batchPlan.baseBatchSize,
      batchPlanMinSize: campaign.batchPlan.minBatchSize,
      batchPlanMaxSize: campaign.batchPlan.maxBatchSize,
      batchPlanAdaptive: campaign.batchPlan.adaptive,
      batchPlanExpansionIncrement: campaign.batchPlan.expansionIncrement,

      executionWindowWeekdays: campaign.executionWindow.allowedWeekdays as unknown as Prisma.CampaignUncheckedCreateInput['executionWindowWeekdays'],
      executionWindowDailyStartHour: campaign.executionWindow.dailyStartHour,
      executionWindowDailyEndHour: campaign.executionWindow.dailyEndHour,
      executionWindowTimezone: campaign.executionWindow.timezone,
      executionWindowRespectHolidays: campaign.executionWindow.respectHolidays,

      rateLimitMaxPerDay: campaign.rateLimitProfile.maxPerDay,
      rateLimitMaxPerHour: campaign.rateLimitProfile.maxPerHour,
      rateLimitMaxPerCompanyPerWindow: campaign.rateLimitProfile.maxPerCompanyPerWindow,

      adaptiveReplyRateFactor: adaptive?.replyRateFactor ?? null,
      adaptiveBounceRateFactor: adaptive?.bounceRateFactor ?? null,
      adaptiveTimeOfDayFactor: adaptive?.timeOfDayFactor ?? null,
      adaptiveWeekdayFactor: adaptive?.weekdayFactor ?? null,
      adaptiveGermanHolidayFactor: adaptive?.germanHolidayFactor ?? null,
      adaptiveCompanyWorkingHoursFactor: adaptive?.companyWorkingHoursFactor ?? null,
      adaptiveCampaignHealthFactor: adaptive?.campaignHealthFactor ?? null,
      adaptiveCompanyFatigueFactor: adaptive?.companyFatigueFactor ?? null,
      adaptiveUserReputationFactor: adaptive?.userReputationFactor ?? null,
      adaptiveRiskScoreFactor: adaptive?.riskScoreFactor ?? null,
      adaptiveComputedBy: adaptive?.computedBy ?? null,
      adaptiveComputedAt: adaptive?.computedAt ?? null,

      checkpointLastCompletedBatchId: campaign.checkpoint?.lastCompletedBatchId ?? null,
      checkpointCursorPosition: campaign.checkpoint?.cursorPosition ?? null,
      checkpointSavedAt: campaign.checkpoint?.savedAt ?? null,

      cooldownStartedAt: campaign.cooldown?.startedAt ?? null,
      cooldownUntil: campaign.cooldown?.until ?? null,
      cooldownReason: (campaign.cooldown?.reason as unknown as Prisma.CampaignUncheckedCreateInput['cooldownReason']) ?? null,

      healthScore: health?.healthScore?.value ?? null,
      riskScore: health?.riskScore?.value ?? null,
      progressScore: health?.progressScore?.value ?? null,
      successTrend: (health?.successTrend as unknown as Prisma.CampaignUncheckedCreateInput['successTrend']) ?? null,
      replyTrend: (health?.replyTrend as unknown as Prisma.CampaignUncheckedCreateInput['replyTrend']) ?? null,
      performanceTrend: (health?.performanceTrend as unknown as Prisma.CampaignUncheckedCreateInput['performanceTrend']) ?? null,
      healthComputedBy: health?.computedBy ?? null,
      healthComputedAt: health?.computedAt ?? null,

      intelBestSendTime: intelligence?.bestSendTime ?? null,
      intelBestBatchSize: intelligence?.bestBatchSize ?? null,
      intelBestCompanyOrder: intelligence?.bestCompanyOrder ? [...intelligence.bestCompanyOrder] : [],
      intelBestResumeDocumentId: intelligence?.bestResumeSelection?.documentId ?? null,
      intelBestResumeConfidence: intelligence?.bestResumeSelection?.confidence?.value ?? null,
      intelBestResumeExplanation: intelligence?.bestResumeSelection?.explanation ?? null,
      intelBestResumeSelectedBy: intelligence?.bestResumeSelection?.selectedBy ?? null,
      intelBestResumeSelectedAt: intelligence?.bestResumeSelection?.selectedAt ?? null,
      intelBestMotivationDocumentId: intelligence?.bestMotivationLetterSelection?.documentId ?? null,
      intelBestMotivationConfidence: intelligence?.bestMotivationLetterSelection?.confidence?.value ?? null,
      intelBestMotivationExplanation: intelligence?.bestMotivationLetterSelection?.explanation ?? null,
      intelBestMotivationSelectedBy: intelligence?.bestMotivationLetterSelection?.selectedBy ?? null,
      intelBestMotivationSelectedAt: intelligence?.bestMotivationLetterSelection?.selectedAt ?? null,
      intelReplyPrediction: intelligence?.replyPrediction?.value ?? null,
      intelInterviewPrediction: intelligence?.interviewPrediction?.value ?? null,
      intelOfferPrediction: intelligence?.offerPrediction?.value ?? null,
      intelContractPrediction: intelligence?.contractPrediction?.value ?? null,
      intelRiskPrediction: intelligence?.riskPrediction?.value ?? null,
      intelDecisionExplanation: intelligence?.decisionExplanation ?? null,
      intelRecommendationExplanation: intelligence?.recommendationExplanation ?? null,
      intelComputedBy: intelligence?.computedBy ?? null,
      intelComputedAt: intelligence?.computedAt ?? null,

      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      startedAt: campaign.startedAt,
      completedAt: campaign.completedAt,
    };
  }

  static toPersistenceTargets(campaign: Campaign): Prisma.CampaignTargetUncheckedCreateInput[] {
    return campaign.targets.map((target) => ({
      id: target.id,
      campaignId: campaign.id,
      jobId: target.jobId,
      companyId: target.companyId,
      status: target.status as unknown as Prisma.CampaignTargetUncheckedCreateInput['status'],
      resumeDocumentId: target.resumeSelection?.documentId ?? null,
      resumeConfidence: target.resumeSelection?.confidence?.value ?? null,
      resumeExplanation: target.resumeSelection?.explanation ?? null,
      resumeSelectedBy: target.resumeSelection?.selectedBy ?? null,
      resumeSelectedAt: target.resumeSelection?.selectedAt ?? null,
      motivationDocumentId: target.motivationLetterSelection?.documentId ?? null,
      motivationConfidence: target.motivationLetterSelection?.confidence?.value ?? null,
      motivationExplanation: target.motivationLetterSelection?.explanation ?? null,
      motivationSelectedBy: target.motivationLetterSelection?.selectedBy ?? null,
      motivationSelectedAt: target.motivationLetterSelection?.selectedAt ?? null,
      addedAt: target.addedAt,
      updatedAt: target.updatedAt,
    }));
  }

  static toPersistenceDispatchAttempts(campaign: Campaign): Prisma.DispatchAttemptUncheckedCreateInput[] {
    return campaign.targets.flatMap((target) =>
      target.dispatchAttempts.map((attempt) => ({
        id: attempt.id,
        targetId: target.id,
        attemptNumber: attempt.attemptNumber,
        attemptedAt: attempt.attemptedAt,
        outcome: attempt.outcome as unknown as Prisma.DispatchAttemptUncheckedCreateInput['outcome'],
        failureReason: attempt.failureReason,
        evidenceType: attempt.evidenceReference?.type ?? null,
        evidenceExternalId: attempt.evidenceReference?.externalId ?? null,
        evidenceUrl: attempt.evidenceReference?.url ?? null,
      })),
    );
  }

  static toPersistenceBatches(campaign: Campaign): Prisma.BatchUncheckedCreateInput[] {
    return campaign.batches.map((batch) => ({
      id: batch.id,
      campaignId: campaign.id,
      plannedSize: batch.plannedSize,
      targetIds: [...batch.targetIds],
      status: batch.status as unknown as Prisma.BatchUncheckedCreateInput['status'],
      startedAt: batch.startedAt,
      completedAt: batch.completedAt,
    }));
  }

  static toPersistenceCompanyMemory(campaign: Campaign): Prisma.CompanyMemoryEntryUncheckedCreateInput[] {
    return campaign.companyMemory.map((entry) => ({
      campaignId: campaign.id,
      companyId: entry.companyId,
      alreadyApplied: entry.alreadyApplied,
      alreadyContacted: entry.alreadyContacted,
      coolingDownUntil: entry.coolingDownUntil,
      previousReplyAt: entry.previousReplyAt,
      interviewCount: entry.interviewCount,
      offerCount: entry.offerCount,
      historicalSuccessScore: entry.historicalSuccessScore?.value ?? null,
      futureAiNotes: entry.futureAiNotes,
      lastInteractionAt: entry.lastInteractionAt,
      updatedAt: entry.updatedAt,
    }));
  }

  static toPersistenceTimelineEntries(campaign: Campaign): Prisma.CampaignTimelineEntryUncheckedCreateInput[] {
    return campaign.timeline.entries().map((entry) => ({
      id: entry.id,
      campaignId: campaign.id,
      timestamp: entry.timestamp,
      actorRole: entry.actor.role as unknown as Prisma.CampaignTimelineEntryUncheckedCreateInput['actorRole'],
      actorId: entry.actor.actorId,
      source: entry.source,
      reasonCode: entry.reason ? (entry.reason.code as unknown as Prisma.CampaignTimelineEntryUncheckedCreateInput['reasonCode']) : null,
      reasonNote: entry.reason?.note ?? null,
      previousState: entry.previousState as unknown as Prisma.CampaignTimelineEntryUncheckedCreateInput['previousState'],
      currentState: entry.currentState as unknown as Prisma.CampaignTimelineEntryUncheckedCreateInput['currentState'],
      metadata: entry.metadata.entries as Prisma.InputJsonValue,
      correlationId: entry.correlationId.value,
      evidenceType: entry.evidenceReference?.type ?? null,
      evidenceExternalId: entry.evidenceReference?.externalId ?? null,
      evidenceUrl: entry.evidenceReference?.url ?? null,
      aiExplanation: entry.aiExplanation,
    }));
  }

  private static toDomainTarget(raw: PrismaCampaignTarget & { dispatchAttempts: PrismaDispatchAttempt[] }): CampaignTarget {
    return CampaignTarget.reconstitute(raw.id, {
      jobId: raw.jobId,
      companyId: raw.companyId,
      status: raw.status as unknown as CampaignTargetStatus,
      resumeSelection: raw.resumeDocumentId
        ? SmartResumeSelection.assign({
            documentId: raw.resumeDocumentId,
            confidence: raw.resumeConfidence !== null ? Probability.create(raw.resumeConfidence) : null,
            explanation: raw.resumeExplanation,
            selectedBy: raw.resumeSelectedBy ?? 'unknown',
            selectedAt: raw.resumeSelectedAt ?? undefined,
          })
        : null,
      motivationLetterSelection: raw.motivationDocumentId
        ? SmartMotivationLetterSelection.assign({
            documentId: raw.motivationDocumentId,
            confidence: raw.motivationConfidence !== null ? Probability.create(raw.motivationConfidence) : null,
            explanation: raw.motivationExplanation,
            selectedBy: raw.motivationSelectedBy ?? 'unknown',
            selectedAt: raw.motivationSelectedAt ?? undefined,
          })
        : null,
      dispatchAttempts: [...raw.dispatchAttempts]
        .sort((a, b) => a.attemptNumber - b.attemptNumber)
        .map((attempt) => CampaignMapper.toDomainDispatchAttempt(attempt)),
      addedAt: raw.addedAt,
      updatedAt: raw.updatedAt,
    });
  }

  private static toDomainDispatchAttempt(raw: PrismaDispatchAttempt): DispatchAttempt {
    return DispatchAttempt.create(raw.id, {
      attemptNumber: raw.attemptNumber,
      attemptedAt: raw.attemptedAt,
      outcome: raw.outcome as unknown as DispatchOutcome,
      failureReason: raw.failureReason,
      evidenceReference: raw.evidenceType
        ? EvidenceReference.create({ type: raw.evidenceType, externalId: raw.evidenceExternalId ?? '', url: raw.evidenceUrl })
        : null,
    });
  }

  private static toDomainBatch(raw: PrismaBatch): Batch {
    return Batch.reconstitute(raw.id, {
      plannedSize: raw.plannedSize,
      targetIds: raw.targetIds,
      status: raw.status as unknown as BatchStatus,
      startedAt: raw.startedAt,
      completedAt: raw.completedAt,
    });
  }

  private static toDomainCompanyMemory(raw: PrismaCompanyMemoryEntry): CompanyMemoryEntry {
    return CompanyMemoryEntry.reconstitute(raw.companyId, {
      companyId: raw.companyId,
      alreadyApplied: raw.alreadyApplied,
      alreadyContacted: raw.alreadyContacted,
      coolingDownUntil: raw.coolingDownUntil,
      previousReplyAt: raw.previousReplyAt,
      interviewCount: raw.interviewCount,
      offerCount: raw.offerCount,
      historicalSuccessScore: raw.historicalSuccessScore !== null ? Probability.create(raw.historicalSuccessScore) : null,
      futureAiNotes: raw.futureAiNotes,
      lastInteractionAt: raw.lastInteractionAt,
      updatedAt: raw.updatedAt,
    });
  }

  private static toDomainTimelineEntry(raw: PrismaCampaignTimelineEntry): CampaignTimelineEntry {
    const actor = Actor.reconstitute(raw.actorRole as unknown as CampaignActorRole, raw.actorId);
    const reason = raw.reasonCode
      ? CampaignReason.create(raw.reasonCode as unknown as CampaignReasonCode, raw.reasonNote)
      : null;
    const evidenceReference = raw.evidenceType
      ? EvidenceReference.create({ type: raw.evidenceType, externalId: raw.evidenceExternalId ?? '', url: raw.evidenceUrl })
      : null;
    const metadata = Metadata.create((raw.metadata as Record<string, string | number | boolean>) ?? {});

    return CampaignTimelineEntry.create(raw.id, {
      timestamp: raw.timestamp,
      actor,
      source: raw.source,
      reason,
      previousState: raw.previousState as unknown as CampaignStatus | null,
      currentState: raw.currentState as unknown as CampaignStatus,
      metadata,
      correlationId: CorrelationId.create(raw.correlationId),
      evidenceReference,
      aiExplanation: raw.aiExplanation,
    });
  }
}
