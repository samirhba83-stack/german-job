import { CampaignOutcomeGoal, CampaignStrategyType, Weekday } from '@german-job-engine/shared-types';
import { CampaignPriorityPolicy } from './campaign-priority.policy';
import { DEFAULT_SCHEDULER_CONFIG } from '../scheduler-config';
import { Campaign } from '../../../campaigns/domain/entities/campaign.entity';
import { CampaignName } from '../../../campaigns/domain/value-objects/campaign-name.vo';
import { CampaignGoal } from '../../../campaigns/domain/value-objects/campaign-goal.vo';
import { CampaignStrategyProfile } from '../../../campaigns/domain/value-objects/campaign-strategy-profile.vo';
import { SmartBatchPlan } from '../../../campaigns/domain/value-objects/smart-batch-plan.vo';
import { ExecutionWindow } from '../../../campaigns/domain/value-objects/execution-window.vo';
import { RateLimitProfile } from '../../../campaigns/domain/value-objects/rate-limit-profile.vo';
import { Actor } from '../../../campaigns/domain/value-objects/actor.vo';
import { CorrelationId } from '../../../campaigns/domain/value-objects/correlation-id.vo';

const NOW = new Date('2026-01-05T12:00:00.000Z');

function buildCampaign(strategyType: CampaignStrategyType, deadline: Date | null): Campaign {
  return Campaign.create(
    '123e4567-e89b-12d3-a456-426614174000',
    'candidate-1',
    CampaignName.create('Priority fixture'),
    CampaignGoal.create({ targetApplicationCount: 5, desiredOutcome: CampaignOutcomeGoal.REPLIES, deadline }),
    CampaignStrategyProfile.create(strategyType),
    SmartBatchPlan.create({ baseBatchSize: 5, minBatchSize: 1, maxBatchSize: 10 }),
    ExecutionWindow.create({ allowedWeekdays: [Weekday.MONDAY], dailyStartHour: 0, dailyEndHour: 24, timezone: 'UTC' }),
    RateLimitProfile.default(),
    Actor.candidate('candidate-1'),
    CorrelationId.create('corr-0'),
  );
}

describe('CampaignPriorityPolicy', () => {
  const policy = new CampaignPriorityPolicy(DEFAULT_SCHEDULER_CONFIG);

  it('weighs AGGRESSIVE above CONSERVATIVE when neither has a deadline', () => {
    const aggressive = policy.evaluate(buildCampaign(CampaignStrategyType.AGGRESSIVE, null), NOW);
    const conservative = policy.evaluate(buildCampaign(CampaignStrategyType.CONSERVATIVE, null), NOW);

    expect(aggressive).toBeGreaterThan(conservative);
    expect(aggressive).toBe(5);
    expect(conservative).toBe(1);
  });

  it('scores an overdue deadline at maximum urgency', () => {
    const campaign = buildCampaign(CampaignStrategyType.BALANCED, new Date('2026-01-05T00:00:00.000Z'));

    expect(policy.evaluate(campaign, NOW)).toBe(3 + 10);
  });

  it('scores a deadline within 24 hours', () => {
    const campaign = buildCampaign(CampaignStrategyType.BALANCED, new Date('2026-01-06T00:00:00.000Z')); // 12h out

    expect(policy.evaluate(campaign, NOW)).toBe(3 + 8);
  });

  it('scores a deadline within 3 days', () => {
    const campaign = buildCampaign(CampaignStrategyType.BALANCED, new Date('2026-01-08T00:00:00.000Z')); // 60h out

    expect(policy.evaluate(campaign, NOW)).toBe(3 + 5);
  });

  it('scores a deadline within 1 week', () => {
    const campaign = buildCampaign(CampaignStrategyType.BALANCED, new Date('2026-01-11T12:00:00.000Z')); // 144h out

    expect(policy.evaluate(campaign, NOW)).toBe(3 + 2);
  });

  it('scores a deadline beyond 1 week the same as no deadline', () => {
    const campaign = buildCampaign(CampaignStrategyType.BALANCED, new Date('2026-01-20T00:00:00.000Z'));
    const noDeadline = buildCampaign(CampaignStrategyType.BALANCED, null);

    expect(policy.evaluate(campaign, NOW)).toBe(3);
    expect(policy.evaluate(noDeadline, NOW)).toBe(3);
  });

  it('honors a custom config, proving weights are replaceable without touching the policy', () => {
    const customPolicy = new CampaignPriorityPolicy({
      priority: {
        ...DEFAULT_SCHEDULER_CONFIG.priority,
        strategyWeights: { ...DEFAULT_SCHEDULER_CONFIG.priority.strategyWeights, [CampaignStrategyType.CONSERVATIVE]: 99 },
      },
    });
    const campaign = buildCampaign(CampaignStrategyType.CONSERVATIVE, null);

    expect(customPolicy.evaluate(campaign, NOW)).toBe(99);
  });
});
