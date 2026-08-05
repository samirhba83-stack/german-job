import { CampaignTargetStatus } from '@german-job-engine/shared-types';
import { Campaign } from '../../domain/entities/campaign.entity';
import { CampaignTimelineEntry } from '../../domain/entities/campaign-timeline-entry.entity';
import {
  CampaignReadModel,
  CampaignTimelineEntryReadModel,
  CampaignHealthReadModel,
  CampaignIntelligenceReadModel,
  CampaignExecutionStatusReadModel,
} from './campaign.read-model';

export class CampaignReadModelMapper {
  static toReadModel(campaign: Campaign): CampaignReadModel {
    return {
      id: campaign.id,
      ownerId: campaign.ownerId,
      name: campaign.name.value,
      status: campaign.status,
      strategy: {
        type: campaign.strategy.type,
        parameters: { ...campaign.strategy.parameters.entries },
      },
      goal: {
        targetApplicationCount: campaign.goal.targetApplicationCount,
        desiredOutcome: campaign.goal.desiredOutcome,
        deadline: campaign.goal.deadline,
      },
      batchPlan: {
        baseBatchSize: campaign.batchPlan.baseBatchSize,
        minBatchSize: campaign.batchPlan.minBatchSize,
        maxBatchSize: campaign.batchPlan.maxBatchSize,
        adaptive: campaign.batchPlan.adaptive,
        expansionIncrement: campaign.batchPlan.expansionIncrement,
      },
      executionWindow: {
        allowedWeekdays: [...campaign.executionWindow.allowedWeekdays],
        dailyStartHour: campaign.executionWindow.dailyStartHour,
        dailyEndHour: campaign.executionWindow.dailyEndHour,
        timezone: campaign.executionWindow.timezone,
        respectHolidays: campaign.executionWindow.respectHolidays,
      },
      rateLimitProfile: {
        maxPerDay: campaign.rateLimitProfile.maxPerDay,
        maxPerHour: campaign.rateLimitProfile.maxPerHour,
        maxPerCompanyPerWindow: campaign.rateLimitProfile.maxPerCompanyPerWindow,
      },
      checkpoint: campaign.checkpoint
        ? {
            lastCompletedBatchId: campaign.checkpoint.lastCompletedBatchId,
            cursorPosition: campaign.checkpoint.cursorPosition,
            savedAt: campaign.checkpoint.savedAt,
          }
        : null,
      cooldown: campaign.cooldown
        ? { startedAt: campaign.cooldown.startedAt, until: campaign.cooldown.until, reason: campaign.cooldown.reason }
        : null,
      health: campaign.health ? CampaignReadModelMapper.toHealthReadModel(campaign) : null,
      intelligence: campaign.intelligence ? CampaignReadModelMapper.toIntelligenceReadModel(campaign) : null,
      targetsCount: campaign.targets.length,
      batchesCount: campaign.batches.length,
      isTerminal: campaign.isTerminal(),
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      startedAt: campaign.startedAt,
      completedAt: campaign.completedAt,
    };
  }

  static toHealthReadModel(campaign: Campaign): CampaignHealthReadModel | null {
    const health = campaign.health;
    if (!health) return null;
    return {
      healthScore: health.healthScore?.value ?? null,
      riskScore: health.riskScore?.value ?? null,
      progressScore: health.progressScore?.value ?? null,
      successTrend: health.successTrend,
      replyTrend: health.replyTrend,
      performanceTrend: health.performanceTrend,
      computedBy: health.computedBy,
      computedAt: health.computedAt,
    };
  }

  static toIntelligenceReadModel(campaign: Campaign): CampaignIntelligenceReadModel | null {
    const intelligence = campaign.intelligence;
    if (!intelligence) return null;
    return {
      bestSendTime: intelligence.bestSendTime,
      bestBatchSize: intelligence.bestBatchSize,
      bestCompanyOrder: intelligence.bestCompanyOrder,
      replyPrediction: intelligence.replyPrediction?.value ?? null,
      interviewPrediction: intelligence.interviewPrediction?.value ?? null,
      offerPrediction: intelligence.offerPrediction?.value ?? null,
      contractPrediction: intelligence.contractPrediction?.value ?? null,
      riskPrediction: intelligence.riskPrediction?.value ?? null,
      decisionExplanation: intelligence.decisionExplanation,
      recommendationExplanation: intelligence.recommendationExplanation,
      computedBy: intelligence.computedBy,
      computedAt: intelligence.computedAt,
    };
  }

  static toTimelineEntryReadModel(entry: CampaignTimelineEntry): CampaignTimelineEntryReadModel {
    return {
      id: entry.id,
      timestamp: entry.timestamp,
      actor: { role: entry.actor.role, actorId: entry.actor.actorId },
      source: entry.source,
      reason: entry.reason ? { code: entry.reason.code, note: entry.reason.note } : null,
      previousState: entry.previousState,
      currentState: entry.currentState,
      metadata: { ...entry.metadata.entries },
      correlationId: entry.correlationId.value,
      evidenceReference: entry.evidenceReference
        ? { type: entry.evidenceReference.type, externalId: entry.evidenceReference.externalId, url: entry.evidenceReference.url }
        : null,
      aiExplanation: entry.aiExplanation,
    };
  }

  static toExecutionStatusReadModel(campaign: Campaign): CampaignExecutionStatusReadModel {
    const latestBatch = campaign.batches.length > 0 ? campaign.batches[campaign.batches.length - 1] : null;

    const breakdown = new Map<CampaignTargetStatus, number>();
    for (const target of campaign.targets) {
      breakdown.set(target.status, (breakdown.get(target.status) ?? 0) + 1);
    }

    const dispatchedCount = campaign.targets.filter((target) => target.status === CampaignTargetStatus.DISPATCHED).length;

    return {
      campaignId: campaign.id,
      status: campaign.status,
      currentBatch: latestBatch
        ? {
            id: latestBatch.id,
            status: latestBatch.status,
            plannedSize: latestBatch.plannedSize,
            targetIds: latestBatch.targetIds,
          }
        : null,
      targetBreakdown: Array.from(breakdown.entries()).map(([status, count]) => ({ status, count })),
      checkpoint: campaign.checkpoint
        ? {
            lastCompletedBatchId: campaign.checkpoint.lastCompletedBatchId,
            cursorPosition: campaign.checkpoint.cursorPosition,
            savedAt: campaign.checkpoint.savedAt,
          }
        : null,
      cooldownActive: campaign.cooldown?.isActive() ?? false,
      goalProgress: { dispatched: dispatchedCount, target: campaign.goal.targetApplicationCount },
    };
  }
}
