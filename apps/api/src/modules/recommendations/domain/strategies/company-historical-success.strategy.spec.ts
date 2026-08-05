import { CampaignOutcomeGoal, CampaignStrategyType, Weekday } from '@german-job-engine/shared-types';
import { CompanyHistoricalSuccessRecommendationStrategy } from './company-historical-success.strategy';
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
import { HistoricalOutcomeSnapshot, RecommendationContext } from '../recommendation-context';
import { DEFAULT_RECOMMENDATION_CONFIG } from '../recommendation-config';

function buildCampaign(): Campaign {
  return Campaign.create(
    '123e4567-e89b-12d3-a456-426614174000',
    'candidate-1',
    CampaignName.create('Targeting fixture'),
    CampaignGoal.create({ targetApplicationCount: 5, desiredOutcome: CampaignOutcomeGoal.REPLIES }),
    CampaignStrategyProfile.create(CampaignStrategyType.BALANCED),
    SmartBatchPlan.create({ baseBatchSize: 5, minBatchSize: 1, maxBatchSize: 10 }),
    ExecutionWindow.create({ allowedWeekdays: [Weekday.MONDAY], dailyStartHour: 0, dailyEndHour: 24, timezone: 'UTC' }),
    RateLimitProfile.default(),
    Actor.candidate('candidate-1'),
    CorrelationId.create('corr-0'),
  );
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

function buildContext(historicalOutcomes: HistoricalOutcomeSnapshot[]): RecommendationContext {
  const map = new Map(historicalOutcomes.map((outcome) => [outcome.companyId, outcome]));
  return {
    executionPlan: buildPlan(),
    campaign: buildCampaign(),
    candidateProfile: null,
    companyProfiles: new Map(),
    historicalOutcomes: map,
  };
}

describe('CompanyHistoricalSuccessRecommendationStrategy', () => {
  const strategy = new CompanyHistoricalSuccessRecommendationStrategy(DEFAULT_RECOMMENDATION_CONFIG);

  it('recommends a not-yet-applied company with a high historical success score', () => {
    const context = buildContext([
      { companyId: 'company-1', alreadyApplied: false, historicalSuccessScoreValue: 0.85, interviewCount: 2, offerCount: 1 },
    ]);

    const [recommendation] = strategy.evaluate(context);

    expect(recommendation.category).toBe('TARGETING');
    expect(recommendation.reasonCode).toBe('HIGH_HISTORICAL_SUCCESS');
    expect(recommendation.expectedImpactScore).toBeCloseTo(0.85, 5);
    expect(recommendation.title).toContain('company-1');
  });

  it('does not recommend a company already applied to', () => {
    const context = buildContext([
      { companyId: 'company-1', alreadyApplied: true, historicalSuccessScoreValue: 0.9, interviewCount: 2, offerCount: 1 },
    ]);

    expect(strategy.evaluate(context)).toEqual([]);
  });

  it('does not recommend a company below the success threshold', () => {
    const context = buildContext([
      { companyId: 'company-1', alreadyApplied: false, historicalSuccessScoreValue: 0.4, interviewCount: 0, offerCount: 0 },
    ]);

    expect(strategy.evaluate(context)).toEqual([]);
  });

  it('does not recommend a company with no historical success score recorded', () => {
    const context = buildContext([
      { companyId: 'company-1', alreadyApplied: false, historicalSuccessScoreValue: null, interviewCount: 0, offerCount: 0 },
    ]);

    expect(strategy.evaluate(context)).toEqual([]);
  });

  it('produces one recommendation per qualifying company', () => {
    const context = buildContext([
      { companyId: 'company-1', alreadyApplied: false, historicalSuccessScoreValue: 0.9, interviewCount: 1, offerCount: 0 },
      { companyId: 'company-2', alreadyApplied: false, historicalSuccessScoreValue: 0.75, interviewCount: 1, offerCount: 1 },
      { companyId: 'company-3', alreadyApplied: false, historicalSuccessScoreValue: 0.2, interviewCount: 0, offerCount: 0 },
    ]);

    const recommendations = strategy.evaluate(context);

    expect(recommendations).toHaveLength(2);
    expect(recommendations.map((r) => r.title).sort()).toEqual([
      'Prioritize company company-1',
      'Prioritize company company-2',
    ]);
  });
});
