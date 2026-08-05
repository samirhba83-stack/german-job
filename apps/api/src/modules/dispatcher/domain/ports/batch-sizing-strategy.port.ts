import { Campaign } from '../../../campaigns/domain/entities/campaign.entity';

export const BATCH_SIZING_STRATEGY = Symbol('BATCH_SIZING_STRATEGY');

/**
 * Computes how many targets the next batch should contain. Exists as a swappable port —
 * per Milestone 4's requirement that the Dispatcher "support future adaptive algorithms without
 * changing public interfaces" — so a future algorithm (e.g. ML-tuned sizing) can replace
 * AdaptiveBatchSizePolicy via a different DI binding; CampaignDispatcherService's code never
 * changes.
 */
export interface BatchSizingStrategy {
  computeBatchSize(campaign: Campaign, pendingCount: number, remainingDailyCapacity: number): number;
}
