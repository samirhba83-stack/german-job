import { Inject, Injectable } from '@nestjs/common';
import { CampaignTargetStatus } from '@german-job-engine/shared-types';
import { Campaign } from '../../../campaigns/domain/entities/campaign.entity';
import { CampaignSchedulerPort, CAMPAIGN_SCHEDULER_PORT } from '../../../scheduler/domain/ports/campaign-scheduler.port';
import { SchedulingDecision } from '../../../scheduler/domain/scheduling-decision';
import { ExecutionClock, EXECUTION_CLOCK } from '../../../execution/domain/ports/execution-clock.port';
import { BatchSizingStrategy, BATCH_SIZING_STRATEGY } from '../../domain/ports/batch-sizing-strategy.port';
import { InboxProtectionStrategy, INBOX_PROTECTION_STRATEGY } from '../../domain/ports/inbox-protection-strategy.port';
import { IntelligentTimingStrategy, INTELLIGENT_TIMING_STRATEGY } from '../../domain/ports/intelligent-timing-strategy.port';
import { DeliveryConfidenceStrategy, DELIVERY_CONFIDENCE_STRATEGY } from '../../domain/ports/delivery-confidence-strategy.port';
import { DispatcherConfig, DISPATCHER_CONFIG } from '../../domain/dispatcher-config';
import { ExecutionAction, ExecutionDecisionFactor, ExecutionPlan } from '../../domain/execution-plan';
import { CampaignDispatcherPort } from '../../domain/ports/campaign-dispatcher.port';

const HOUR_MS = 60 * 60 * 1000;

/**
 * The "Core Brain" of Phase 4: turns each Scheduler-eligible campaign into a fully explained
 * ExecutionPlan. Never dispatches anything — no SMTP, no worker invocation, no knowledge of any
 * delivery provider — only computes and returns recommendations. Optimizes for successful
 * delivery, not send volume: InboxProtection can refuse a campaign the Scheduler already deemed
 * technically eligible.
 *
 * Every scoring/strategy dependency is injected via a DI port (Phase 4 architecture review) —
 * this service composes them but implements none of their logic itself, so replacing any one
 * (e.g. swapping in an ML-trained risk model) never requires a change here.
 */
@Injectable()
export class CampaignDispatcherService implements CampaignDispatcherPort {
  constructor(
    @Inject(CAMPAIGN_SCHEDULER_PORT) private readonly schedulerService: CampaignSchedulerPort,
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
    @Inject(BATCH_SIZING_STRATEGY) private readonly batchSizingStrategy: BatchSizingStrategy,
    @Inject(INBOX_PROTECTION_STRATEGY) private readonly inboxProtectionStrategy: InboxProtectionStrategy,
    @Inject(INTELLIGENT_TIMING_STRATEGY) private readonly intelligentTimingStrategy: IntelligentTimingStrategy,
    @Inject(DELIVERY_CONFIDENCE_STRATEGY) private readonly deliveryConfidenceStrategy: DeliveryConfidenceStrategy,
    @Inject(DISPATCHER_CONFIG) private readonly config: DispatcherConfig,
  ) {}

  async buildExecutionPlans(): Promise<ExecutionPlan[]> {
    const pairs = await this.buildExecutionPlansWithEntities();
    return pairs.map((pair) => pair.plan);
  }

  /**
   * Same as buildExecutionPlans(), but keeps the source Campaign alongside each plan. A plan's
   * scalar fields aren't enough for a consumer that needs to reason about the campaign itself
   * (e.g. the Recommendation Engine, which analyzes health, goal, strategy, and company memory
   * alongside the plan) — added here rather than having that consumer re-fetch and re-derive
   * plans independently, which would duplicate this exact evaluation logic.
   */
  async buildExecutionPlansWithEntities(): Promise<Array<{ plan: ExecutionPlan; campaign: Campaign }>> {
    const now = this.clock.now();
    const eligible = await this.schedulerService.getEligibleCampaignsWithEntities();
    return eligible.map(({ campaign, decision }) => ({ campaign, plan: this.buildPlan(campaign, decision, now) }));
  }

  private buildPlan(campaign: Campaign, decision: SchedulingDecision, now: Date): ExecutionPlan {
    const decisionLog: ExecutionDecisionFactor[] = [];

    const risk = this.inboxProtectionStrategy.assess(campaign, now);
    decisionLog.push({
      factor: 'INBOX_PROTECTION',
      reasonCode: risk.decision.reasonCode,
      explanation: risk.decision.explanation,
    });

    const pendingCount = campaign.targets.filter((target) => target.status === CampaignTargetStatus.PENDING).length;
    const dispatchedInLast24h = campaign.dispatchedInLast24Hours(now);
    const remainingDailyCapacity = Math.max(0, campaign.rateLimitProfile.maxPerDay - dispatchedInLast24h);

    const recommendedBatchSize = risk.decision.allowed
      ? this.batchSizingStrategy.computeBatchSize(campaign, pendingCount, remainingDailyCapacity)
      : 0;
    decisionLog.push({
      factor: 'ADAPTIVE_BATCH_SIZE',
      reasonCode: risk.decision.allowed ? 'BATCH_SIZE_COMPUTED' : 'BATCH_SIZE_SUPPRESSED',
      explanation: risk.decision.allowed
        ? `Recommended batch size of ${recommendedBatchSize} for batch #${campaign.batches.length + 1}, bounded by pending targets, remaining daily capacity, and the batch plan's own limits.`
        : 'Batch size suppressed to 0 because Inbox Protection denied execution.',
    });

    const delayBetweenEmailsMs = Math.floor(HOUR_MS / Math.max(1, campaign.rateLimitProfile.maxPerHour));
    const cooldownAfterBatchMs = Math.round(this.config.pacing.baseCooldownMs * (1 + risk.riskScore));

    const earliestExecutionAt = risk.decision.allowed
      ? now
      : new Date(now.getTime() + this.config.pacing.riskReevaluationDelayMs);
    decisionLog.push({
      factor: 'EARLIEST_EXECUTION_TIME',
      reasonCode: risk.decision.allowed ? 'NO_HARD_BLOCKER' : 'RISK_DELAYED',
      explanation: risk.decision.allowed
        ? 'No Inbox Protection blocker at the current instant.'
        : `Delaying until ${earliestExecutionAt.toISOString()} before re-evaluating risk.`,
    });

    const timing = this.intelligentTimingStrategy.recommend(earliestExecutionAt, campaign.executionWindow.timezone);
    decisionLog.push({ factor: 'INTELLIGENT_TIMING', reasonCode: timing.reasonCode, explanation: timing.explanation });

    const recommendedExecutionAt = timing.recommendedAt > earliestExecutionAt ? timing.recommendedAt : earliestExecutionAt;
    const deliveryConfidenceScore = this.deliveryConfidenceStrategy.evaluate(campaign, risk.riskScore);
    const recommendedAction: ExecutionAction =
      risk.decision.allowed && recommendedExecutionAt.getTime() <= now.getTime() ? 'DISPATCH_NOW' : 'DELAY';

    return {
      campaignId: campaign.id,
      recommendedAction,
      executionPriority: decision.priority,
      recommendedBatchSize,
      delayBetweenEmailsMs,
      cooldownAfterBatchMs,
      recommendedExecutionWindow: campaign.executionWindow,
      earliestExecutionAt,
      recommendedExecutionAt,
      riskScore: risk.riskScore,
      deliveryConfidenceScore,
      decisionLog,
    };
  }
}
