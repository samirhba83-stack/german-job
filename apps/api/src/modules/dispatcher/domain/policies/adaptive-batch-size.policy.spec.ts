import { CampaignOutcomeGoal, CampaignStrategyType, Weekday } from '@german-job-engine/shared-types';
import { AdaptiveBatchSizePolicy } from './adaptive-batch-size.policy';
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

function alwaysOpenWindow(): ExecutionWindow {
  return ExecutionWindow.create({
    allowedWeekdays: [
      Weekday.MONDAY, Weekday.TUESDAY, Weekday.WEDNESDAY, Weekday.THURSDAY,
      Weekday.FRIDAY, Weekday.SATURDAY, Weekday.SUNDAY,
    ],
    dailyStartHour: 0,
    dailyEndHour: 24,
    timezone: 'UTC',
    respectHolidays: false,
  });
}

function buildCampaign(options: {
  adaptive: boolean;
  expansionIncrement?: number | null;
  maxBatchSize?: number;
  alreadyPlannedBatches?: number;
  targetCount?: number;
  healthScore?: number | null;
}): Campaign {
  const campaign = Campaign.create(
    '123e4567-e89b-12d3-a456-426614174000',
    OWNER_ID,
    CampaignName.create('Adaptive batch fixture'),
    CampaignGoal.create({ targetApplicationCount: 5, desiredOutcome: CampaignOutcomeGoal.REPLIES }),
    CampaignStrategyProfile.create(CampaignStrategyType.BALANCED),
    SmartBatchPlan.create({
      baseBatchSize: 5,
      minBatchSize: 1,
      maxBatchSize: options.maxBatchSize ?? 100,
      adaptive: options.adaptive,
      expansionIncrement: options.expansionIncrement ?? null,
    }),
    alwaysOpenWindow(),
    RateLimitProfile.create({ maxPerDay: 1000, maxPerHour: 1000, maxPerCompanyPerWindow: 1000 }),
    Actor.candidate(OWNER_ID),
    correlationId(),
  );

  const targetCount = options.targetCount ?? 100;
  for (let i = 0; i < targetCount; i += 1) {
    campaign.addTarget(`job-${i}`, `company-${i}`, Actor.candidate(OWNER_ID), correlationId());
  }
  campaign.markReady(Actor.candidate(OWNER_ID), correlationId());
  campaign.start(Actor.candidate(OWNER_ID), correlationId());

  const alreadyPlannedBatches = options.alreadyPlannedBatches ?? 0;
  for (let i = 0; i < alreadyPlannedBatches; i += 1) {
    campaign.planNextBatch(Actor.system('scheduler'), correlationId());
  }

  if (options.healthScore !== undefined && options.healthScore !== null) {
    campaign.recordHealthAssessment(
      CampaignHealth.create({ healthScore: Probability.create(options.healthScore), computedBy: 'test-engine' }),
      Actor.system('test-engine'),
      correlationId(),
    );
  }

  return campaign;
}

describe('AdaptiveBatchSizePolicy', () => {
  const policy = new AdaptiveBatchSizePolicy(DEFAULT_DISPATCHER_CONFIG);

  it('always uses baseBatchSize when the plan is not adaptive, regardless of batch history', () => {
    const campaign = buildCampaign({ adaptive: false, alreadyPlannedBatches: 3 });

    expect(policy.computeBatchSize(campaign, 100, 1000)).toBe(5);
  });

  it('uses baseBatchSize for the first adaptive batch (batch #1)', () => {
    const campaign = buildCampaign({ adaptive: true, expansionIncrement: 5, alreadyPlannedBatches: 0 });

    expect(policy.computeBatchSize(campaign, 100, 1000)).toBe(5);
  });

  it('escalates to 10 for the second adaptive batch, matching the milestone example', () => {
    const campaign = buildCampaign({ adaptive: true, expansionIncrement: 5, alreadyPlannedBatches: 1 });

    expect(policy.computeBatchSize(campaign, 100, 1000)).toBe(10);
  });

  it('escalates to 15 for the third adaptive batch, matching the milestone example', () => {
    const campaign = buildCampaign({ adaptive: true, expansionIncrement: 5, alreadyPlannedBatches: 2 });

    expect(policy.computeBatchSize(campaign, 100, 1000)).toBe(15);
  });

  it('caps the escalated size at maxBatchSize', () => {
    const campaign = buildCampaign({ adaptive: true, expansionIncrement: 5, maxBatchSize: 12, alreadyPlannedBatches: 2 });

    expect(policy.computeBatchSize(campaign, 100, 1000)).toBe(12);
  });

  it('caps the size at the pending target count', () => {
    const campaign = buildCampaign({ adaptive: true, expansionIncrement: 5, alreadyPlannedBatches: 2, targetCount: 3 });

    expect(policy.computeBatchSize(campaign, 3, 1000)).toBe(3);
  });

  it('caps the size at remaining daily capacity', () => {
    const campaign = buildCampaign({ adaptive: true, expansionIncrement: 5, alreadyPlannedBatches: 2 });

    expect(policy.computeBatchSize(campaign, 100, 4)).toBe(4);
  });

  it('falls back to baseBatchSize when campaign health is poor', () => {
    const campaign = buildCampaign({ adaptive: true, expansionIncrement: 5, alreadyPlannedBatches: 2, healthScore: 0.2 });

    expect(policy.computeBatchSize(campaign, 100, 1000)).toBe(5);
  });

  it('treats a health score exactly at the threshold as good', () => {
    const campaign = buildCampaign({ adaptive: true, expansionIncrement: 5, alreadyPlannedBatches: 2, healthScore: 0.5 });

    expect(policy.computeBatchSize(campaign, 100, 1000)).toBe(15);
  });

  it('treats no recorded health assessment as good', () => {
    const campaign = buildCampaign({ adaptive: true, expansionIncrement: 5, alreadyPlannedBatches: 2, healthScore: null });

    expect(policy.computeBatchSize(campaign, 100, 1000)).toBe(15);
  });
});
