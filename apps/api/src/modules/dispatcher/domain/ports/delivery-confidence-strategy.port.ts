import { Campaign } from '../../../campaigns/domain/entities/campaign.entity';

export const DELIVERY_CONFIDENCE_STRATEGY = Symbol('DELIVERY_CONFIDENCE_STRATEGY');

/**
 * Scores confidence (0..1) that execution right now would actually deliver successfully. A DI
 * port so a future milestone can replace the health/risk-blend default (DeliveryConfidencePolicy)
 * with a trained model without changing CampaignDispatcherService.
 */
export interface DeliveryConfidenceStrategy {
  evaluate(campaign: Campaign, riskScore: number): number;
}
