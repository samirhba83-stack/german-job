import { Inject, Injectable } from '@nestjs/common';
import { Campaign } from '../../../campaigns/domain/entities/campaign.entity';
import { PriorityStrategy } from '../ports/priority-strategy.port';
import { DeadlineUrgencyTier, PriorityConfig, SchedulerConfig, SCHEDULER_CONFIG } from '../scheduler-config';

const HOUR_MS = 60 * 60 * 1000;

/**
 * Deterministic execution-order score among eligible campaigns — pure arithmetic over two
 * declared, explicit factors, never prediction. `strategyType` was previously stored but never
 * read by any domain rule ("interpretation belongs to a future tuning engine" — this policy is
 * that engine's first real consumer); `goal.deadline` is likewise read for the first time here.
 * All weights are injected via SCHEDULER_CONFIG rather than hardcoded, so they can be tuned (or
 * replaced by an entirely different PriorityStrategy) without touching CampaignSchedulerService.
 */
@Injectable()
export class CampaignPriorityPolicy implements PriorityStrategy {
  private readonly config: PriorityConfig;

  constructor(@Inject(SCHEDULER_CONFIG) config: SchedulerConfig) {
    this.config = config.priority;
  }

  evaluate(campaign: Campaign, now: Date): number {
    return this.config.strategyWeights[campaign.strategy.type] + this.deadlineUrgency(campaign.goal.deadline, now);
  }

  private deadlineUrgency(deadline: Date | null, now: Date): number {
    if (!deadline) {
      return this.config.noUrgencyWeight;
    }

    const hoursRemaining = (deadline.getTime() - now.getTime()) / HOUR_MS;

    if (hoursRemaining <= 0) {
      return this.config.overdueWeight;
    }

    const tier = this.findTier(hoursRemaining);
    return tier ? tier.weight : this.config.noUrgencyWeight;
  }

  private findTier(hoursRemaining: number): DeadlineUrgencyTier | undefined {
    return this.config.deadlineUrgencyTiers.find((candidate) => hoursRemaining <= candidate.withinHours);
  }
}
