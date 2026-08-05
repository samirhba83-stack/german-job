import { CampaignOutcomeGoal, CampaignStrategyType, Weekday } from '@german-job-engine/shared-types';
import { DeliveryConfidencePolicy } from './delivery-confidence.policy';
import { Campaign } from '../../../campaigns/domain/entities/campaign.entity';
import { CampaignName } from '../../../campaigns/domain/value-objects/campaign-name.vo';
import { CampaignGoal } from '../../../campaigns/domain/value-objects/campaign-goal.vo';
import { CampaignStrategyProfile } from '../../../campaigns/domain/value-objects/campaign-strategy-profile.vo';
import { SmartBatchPlan } from '../../../campaigns/domain/value-objects/smart-batch-plan.vo';
import { ExecutionWindow } from '../../../campaigns/domain/value-objects/execution-window.vo';
import { RateLimitProfile } from '../../../campaigns/domain/value-objects/rate-limit-profile.vo';
import { Actor } from '../../../campaigns/domain/value-objects/actor.vo';
import { CorrelationId } from '../../../campaigns/domain/value-objects/correlation-id.vo';
import { CampaignHealth } from '../../../campaigns/domain/value-objects/campaign-health.vo';
import { Probability } from '../../../campaigns/domain/value-objects/probability.vo';
import { DEFAULT_DISPATCHER_CONFIG } from '../dispatcher-config';

const OWNER_ID = 'candidate-1';

function correlationId(): CorrelationId {
  return CorrelationId.create('corr-1');
}

function buildCampaign(healthScore: number | null): Campaign {
  const campaign = Campaign.create(
    '123e4567-e89b-12d3-a456-426614174000',
    OWNER_ID,
    CampaignName.create('Confidence fixture'),
    CampaignGoal.create({ targetApplicationCount: 5, desiredOutcome: CampaignOutcomeGoal.REPLIES }),
    CampaignStrategyProfile.create(CampaignStrategyType.BALANCED),
    SmartBatchPlan.create({ baseBatchSize: 5, minBatchSize: 1, maxBatchSize: 10 }),
    ExecutionWindow.create({ allowedWeekdays: [Weekday.MONDAY], dailyStartHour: 0, dailyEndHour: 24, timezone: 'UTC' }),
    RateLimitProfile.default(),
    Actor.candidate(OWNER_ID),
    correlationId(),
  );

  if (healthScore !== null) {
    campaign.recordHealthAssessment(
      CampaignHealth.create({ healthScore: Probability.create(healthScore), computedBy: 'test-engine' }),
      Actor.system('test-engine'),
      correlationId(),
    );
  }

  return campaign;
}

describe('DeliveryConfidencePolicy', () => {
  const policy = new DeliveryConfidencePolicy(DEFAULT_DISPATCHER_CONFIG);

  it('falls back to pure risk-inversion when no health assessment exists', () => {
    const campaign = buildCampaign(null);

    expect(policy.evaluate(campaign, 0.3)).toBeCloseTo(0.7, 5);
  });

  it('blends health score and risk-inversion evenly when a health assessment exists', () => {
    const campaign = buildCampaign(0.8);

    // 0.5*0.8 + 0.5*(1-0.2) = 0.4 + 0.4 = 0.8
    expect(policy.evaluate(campaign, 0.2)).toBeCloseTo(0.8, 5);
  });

  it('stays within [0, 1] at the extremes', () => {
    const campaign = buildCampaign(1);

    expect(policy.evaluate(campaign, 0)).toBeLessThanOrEqual(1);
    expect(policy.evaluate(campaign, 1)).toBeGreaterThanOrEqual(0);
  });
});
