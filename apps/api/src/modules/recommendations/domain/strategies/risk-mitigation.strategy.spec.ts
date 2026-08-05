import { CampaignOutcomeGoal, CampaignStrategyType, Weekday } from '@german-job-engine/shared-types';
import { RiskMitigationRecommendationStrategy } from './risk-mitigation.strategy';
import { Campaign } from '../../../campaigns/domain/entities/campaign.entity';
import { CampaignName } from '../../../campaigns/domain/value-objects/campaign-name.vo';
import { CampaignGoal } from '../../../campaigns/domain/value-objects/campaign-goal.vo';
import { CampaignStrategyProfile } from '../../../campaigns/domain/value-objects/campaign-strategy-profile.vo';
import { SmartBatchPlan } from '../../../campaigns/domain/value-objects/smart-batch-plan.vo';
import { ExecutionWindow } from '../../../campaigns/domain/value-objects/execution-window.vo';
import { RateLimitProfile } from '../../../campaigns/domain/value-objects/rate-limit-profile.vo';
import { Actor } from '../../../campaigns/domain/value-objects/actor.vo';
import { CorrelationId } from '../../../campaigns/domain/value-objects/correlation-id.vo';
import { ExecutionPlan } from '../../../dispatcher/domain/execution-plan';
import { RecommendationContext } from '../recommendation-context';
import { DEFAULT_RECOMMENDATION_CONFIG } from '../recommendation-config';

function buildCampaign(): Campaign {
  return Campaign.create(
    '123e4567-e89b-12d3-a456-426614174000',
    'candidate-1',
    CampaignName.create('Risk fixture'),
    CampaignGoal.create({ targetApplicationCount: 5, desiredOutcome: CampaignOutcomeGoal.REPLIES }),
    CampaignStrategyProfile.create(CampaignStrategyType.BALANCED),
    SmartBatchPlan.create({ baseBatchSize: 5, minBatchSize: 1, maxBatchSize: 10 }),
    ExecutionWindow.create({ allowedWeekdays: [Weekday.MONDAY], dailyStartHour: 0, dailyEndHour: 24, timezone: 'UTC' }),
    RateLimitProfile.default(),
    Actor.candidate('candidate-1'),
    CorrelationId.create('corr-0'),
  );
}

function buildPlan(riskScore: number): ExecutionPlan {
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
    riskScore,
    deliveryConfidenceScore: 1 - riskScore,
    decisionLog: [],
  };
}

function buildContext(riskScore: number): RecommendationContext {
  return {
    executionPlan: buildPlan(riskScore),
    campaign: buildCampaign(),
    candidateProfile: null,
    companyProfiles: new Map(),
    historicalOutcomes: new Map(),
  };
}

describe('RiskMitigationRecommendationStrategy', () => {
  const strategy = new RiskMitigationRecommendationStrategy(DEFAULT_RECOMMENDATION_CONFIG);

  it('produces no recommendation when risk is below the elevated threshold', () => {
    expect(strategy.evaluate(buildContext(0.3))).toEqual([]);
  });

  it('recommends mitigation when risk is at or above the elevated threshold', () => {
    const [recommendation] = strategy.evaluate(buildContext(0.6));

    expect(recommendation.campaignId).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(recommendation.category).toBe('RISK');
    expect(recommendation.reasonCode).toBe('ELEVATED_RISK_SCORE');
    expect(recommendation.expectedImpactScore).toBeCloseTo(0.6, 5);
    expect(recommendation.producedBy).toBe('RISK_MITIGATION');
    expect(recommendation.explanation).toContain('0.60');
  });
});
