import { CampaignOutcomeGoal, CampaignStrategyType, Weekday } from '@german-job-engine/shared-types';
import { CampaignHealthRecommendationStrategy } from './campaign-health.strategy';
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
import { ExecutionPlan } from '../../../dispatcher/domain/execution-plan';
import { RecommendationContext } from '../recommendation-context';
import { DEFAULT_RECOMMENDATION_CONFIG } from '../recommendation-config';

function correlationId(): CorrelationId {
  return CorrelationId.create('corr-1');
}

function buildCampaign(healthScore: number | null): Campaign {
  const campaign = Campaign.create(
    '123e4567-e89b-12d3-a456-426614174000',
    'candidate-1',
    CampaignName.create('Health fixture'),
    CampaignGoal.create({ targetApplicationCount: 5, desiredOutcome: CampaignOutcomeGoal.REPLIES }),
    CampaignStrategyProfile.create(CampaignStrategyType.BALANCED),
    SmartBatchPlan.create({ baseBatchSize: 5, minBatchSize: 1, maxBatchSize: 10 }),
    ExecutionWindow.create({ allowedWeekdays: [Weekday.MONDAY], dailyStartHour: 0, dailyEndHour: 24, timezone: 'UTC' }),
    RateLimitProfile.default(),
    Actor.candidate('candidate-1'),
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

function buildPlan(): ExecutionPlan {
  const now = new Date('2026-01-05T10:00:00.000Z');
  return {
    campaignId: '123e4567-e89b-12d3-a456-426614174000',
    recommendedAction: 'DISPATCH_NOW',
    executionPriority: 3,
    recommendedBatchSize: 5,
    delayBetweenEmailsMs: 1000,
    cooldownAfterBatchMs: 1000,
    recommendedExecutionWindow: ExecutionWindow.create({
      allowedWeekdays: [Weekday.MONDAY],
      dailyStartHour: 0,
      dailyEndHour: 24,
      timezone: 'UTC',
    }),
    earliestExecutionAt: now,
    recommendedExecutionAt: now,
    riskScore: 0,
    deliveryConfidenceScore: 1,
    decisionLog: [],
  };
}

function buildContext(healthScore: number | null): RecommendationContext {
  return {
    executionPlan: buildPlan(),
    campaign: buildCampaign(healthScore),
    candidateProfile: null,
    companyProfiles: new Map(),
    historicalOutcomes: new Map(),
  };
}

describe('CampaignHealthRecommendationStrategy', () => {
  const strategy = new CampaignHealthRecommendationStrategy(DEFAULT_RECOMMENDATION_CONFIG);

  it('abstains when no health assessment has been recorded', () => {
    expect(strategy.evaluate(buildContext(null))).toEqual([]);
  });

  it('abstains when health is at or above the low-health threshold', () => {
    expect(strategy.evaluate(buildContext(0.4))).toEqual([]);
  });

  it('recommends a strategy review when health is below the threshold', () => {
    const [recommendation] = strategy.evaluate(buildContext(0.2));

    expect(recommendation.category).toBe('STRATEGY');
    expect(recommendation.reasonCode).toBe('LOW_CAMPAIGN_HEALTH');
    expect(recommendation.expectedImpactScore).toBeCloseTo(0.8, 5);
  });
});
