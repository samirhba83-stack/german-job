import { Inject, Injectable } from '@nestjs/common';
import { Campaign } from '../../../campaigns/domain/entities/campaign.entity';
import { clamp01 } from '../../../../shared/domain';
import { DeliveryConfidenceStrategy } from '../ports/delivery-confidence-strategy.port';
import { DispatcherConfig, DISPATCHER_CONFIG } from '../dispatcher-config';

/**
 * Default DELIVERY_CONFIDENCE_STRATEGY binding. How confident the engine is that execution
 * right now would actually deliver successfully (land in the inbox, not bounce or trigger spam
 * filtering) — the counterpart to riskScore. Blends CampaignHealth.healthScore (reserved since
 * Phase 4 M1, "fully reserved... nothing in the domain reads it yet") with
 * InboxProtectionPolicy's risk score; falls back to pure risk-inversion when no health
 * assessment has been recorded yet. Weights come from injected DispatcherConfig.
 */
@Injectable()
export class DeliveryConfidencePolicy implements DeliveryConfidenceStrategy {
  constructor(@Inject(DISPATCHER_CONFIG) private readonly config: DispatcherConfig) {}

  evaluate(campaign: Campaign, riskScore: number): number {
    const healthScore = campaign.health?.healthScore?.value ?? null;
    const riskInverse = 1 - clamp01(riskScore);

    if (healthScore === null) {
      return clamp01(riskInverse);
    }

    const { healthWeight, riskInverseWeight } = this.config.deliveryConfidence;
    return clamp01(healthWeight * healthScore + riskInverseWeight * riskInverse);
  }
}
