import { Inject, Injectable } from '@nestjs/common';
import { Campaign } from '../../../campaigns/domain/entities/campaign.entity';
import { BatchSizingStrategy } from '../ports/batch-sizing-strategy.port';
import { DispatcherConfig, DISPATCHER_CONFIG } from '../dispatcher-config';

/**
 * Default BATCH_SIZING_STRATEGY binding. Implements the escalating pattern Milestone 4
 * specifies (batch 1 -> 5, batch 2 -> 10, batch 3 -> 15, ...): batch size grows by
 * `batchPlan.expansionIncrement` per already-completed batch, but only while
 * `batchPlan.adaptive` is true and campaign health remains good — closing the loop on a field
 * that was reserved-but-unread since Phase 4 M1 ("a future engine must call the reserved
 * adjustBatchSize() hook" — no such mutating hook exists or is needed, since this policy only
 * recommends a size; it never mutates the campaign).
 */
@Injectable()
export class AdaptiveBatchSizePolicy implements BatchSizingStrategy {
  constructor(@Inject(DISPATCHER_CONFIG) private readonly config: DispatcherConfig) {}

  computeBatchSize(campaign: Campaign, pendingCount: number, remainingDailyCapacity: number): number {
    const plan = campaign.batchPlan;
    const alreadyPlannedBatches = campaign.batches.length;

    const target =
      plan.adaptive && plan.expansionIncrement !== null && this.healthIsGood(campaign)
        ? plan.baseBatchSize + alreadyPlannedBatches * plan.expansionIncrement
        : plan.baseBatchSize;

    const capped = Math.min(target, plan.maxBatchSize, pendingCount, remainingDailyCapacity);
    return Math.max(0, capped);
  }

  /** No health assessment recorded yet is treated as good — only positive evidence of a
   * problem should pause escalation, not the mere absence of an assessment. */
  private healthIsGood(campaign: Campaign): boolean {
    const score = campaign.health?.healthScore?.value;
    return score === undefined || score === null || score >= this.config.adaptiveBatchSize.healthGoodThreshold;
  }
}
