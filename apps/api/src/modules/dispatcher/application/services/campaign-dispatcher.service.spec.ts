import { CampaignOutcomeGoal, CampaignStrategyType, Weekday } from '@german-job-engine/shared-types';
import { CampaignDispatcherService } from './campaign-dispatcher.service';
import { AdaptiveBatchSizePolicy } from '../../domain/policies/adaptive-batch-size.policy';
import { InboxProtectionPolicy } from '../../domain/policies/inbox-protection.policy';
import { IntelligentTimingPolicy } from '../../domain/policies/intelligent-timing.policy';
import { DeliveryConfidencePolicy } from '../../domain/policies/delivery-confidence.policy';
import { DEFAULT_DISPATCHER_CONFIG } from '../../domain/dispatcher-config';
import { Campaign } from '../../../campaigns/domain/entities/campaign.entity';
import { CampaignName } from '../../../campaigns/domain/value-objects/campaign-name.vo';
import { CampaignGoal } from '../../../campaigns/domain/value-objects/campaign-goal.vo';
import { CampaignStrategyProfile } from '../../../campaigns/domain/value-objects/campaign-strategy-profile.vo';
import { SmartBatchPlan } from '../../../campaigns/domain/value-objects/smart-batch-plan.vo';
import { ExecutionWindow } from '../../../campaigns/domain/value-objects/execution-window.vo';
import { RateLimitProfile } from '../../../campaigns/domain/value-objects/rate-limit-profile.vo';
import { Actor } from '../../../campaigns/domain/value-objects/actor.vo';
import { CorrelationId } from '../../../campaigns/domain/value-objects/correlation-id.vo';
import { FixedClock } from '../../../execution/infrastructure/clock/fixed-clock';
import { SchedulingDecision } from '../../../scheduler/domain/scheduling-decision';
import { CampaignSchedulerPort } from '../../../scheduler/domain/ports/campaign-scheduler.port';

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

function buildRunningCampaign(id: string, options: { successCount?: number; failureCount?: number; maxPerDay?: number } = {}): Campaign {
  const successCount = options.successCount ?? 0;
  const failureCount = options.failureCount ?? 0;
  const totalTargets = successCount + failureCount + 5;

  const campaign = Campaign.create(
    id,
    OWNER_ID,
    CampaignName.create(`Campaign ${id}`),
    CampaignGoal.create({ targetApplicationCount: 5, desiredOutcome: CampaignOutcomeGoal.REPLIES }),
    CampaignStrategyProfile.create(CampaignStrategyType.BALANCED),
    SmartBatchPlan.create({ baseBatchSize: 5, minBatchSize: 1, maxBatchSize: 20 }),
    alwaysOpenWindow(),
    RateLimitProfile.create({ maxPerDay: options.maxPerDay ?? 1000, maxPerHour: 1000, maxPerCompanyPerWindow: 1000 }),
    Actor.candidate(OWNER_ID),
    correlationId(),
  );

  const ids: string[] = [];
  for (let i = 0; i < totalTargets; i += 1) {
    const target = campaign.addTarget(`job-${i}`, `company-${i}`, Actor.candidate(OWNER_ID), correlationId());
    ids.push(target.id);
  }
  campaign.markReady(Actor.candidate(OWNER_ID), correlationId());
  campaign.start(Actor.candidate(OWNER_ID), correlationId());

  let cursor = 0;
  for (let i = 0; i < successCount; i += 1) {
    campaign.dispatchTarget(ids[cursor], Actor.system('dispatcher'), correlationId());
    cursor += 1;
  }
  for (let i = 0; i < failureCount; i += 1) {
    campaign.recordTargetFailure(ids[cursor], 'smtp timeout', Actor.system('dispatcher'), correlationId());
    cursor += 1;
  }

  return campaign;
}

function decisionFor(campaign: Campaign, priority = 3): SchedulingDecision {
  return {
    campaignId: campaign.id,
    eligible: true,
    reasonCode: 'ALLOWED',
    explanation: 'Allowed.',
    priority,
    plannedBatchSize: 5,
    nextExecutionAt: null,
  };
}

function fakeScheduler(pairs: Array<{ campaign: Campaign; decision: SchedulingDecision }>): CampaignSchedulerPort {
  return { getEligibleCampaignsWithEntities: jest.fn().mockResolvedValue(pairs) };
}

function createService(scheduler: CampaignSchedulerPort, clock: FixedClock): CampaignDispatcherService {
  return new CampaignDispatcherService(
    scheduler,
    clock,
    new AdaptiveBatchSizePolicy(DEFAULT_DISPATCHER_CONFIG),
    new InboxProtectionPolicy(DEFAULT_DISPATCHER_CONFIG),
    new IntelligentTimingPolicy(DEFAULT_DISPATCHER_CONFIG),
    new DeliveryConfidencePolicy(DEFAULT_DISPATCHER_CONFIG),
    DEFAULT_DISPATCHER_CONFIG,
  );
}

describe('CampaignDispatcherService', () => {
  it('recommends immediate dispatch with full explanation for a healthy, low-risk campaign', async () => {
    const NOW = new Date('2026-01-05T10:00:00.000Z'); // Monday, within business hours
    const campaign = buildRunningCampaign('11111111-1111-1111-1111-111111111111');
    const scheduler = fakeScheduler([{ campaign, decision: decisionFor(campaign, 7) }]);
    const service = createService(scheduler, new FixedClock(NOW));

    const [plan] = await service.buildExecutionPlans();

    expect(plan.campaignId).toBe(campaign.id);
    expect(plan.recommendedAction).toBe('DISPATCH_NOW');
    expect(plan.executionPriority).toBe(7);
    expect(plan.recommendedBatchSize).toBe(5);
    expect(plan.riskScore).toBe(0);
    expect(plan.earliestExecutionAt).toEqual(NOW);
    expect(plan.recommendedExecutionAt).toEqual(NOW);
    expect(plan.decisionLog.map((entry) => entry.factor)).toEqual([
      'INBOX_PROTECTION',
      'ADAPTIVE_BATCH_SIZE',
      'EARLIEST_EXECUTION_TIME',
      'INTELLIGENT_TIMING',
    ]);
  });

  it('delays a high-risk campaign and suppresses its batch size to zero', async () => {
    // dailyUtilization = 9/10 = 0.9, failureRate = 15/24 = 0.625 -> risk ~0.79 (>= 0.75 threshold)
    const campaign = buildRunningCampaign('22222222-2222-2222-2222-222222222222', {
      successCount: 9,
      failureCount: 15,
      maxPerDay: 10,
    });
    // dispatchTarget()/recordTargetFailure() timestamp with the real wall clock, so the clock
    // driving the assessment must be captured after building the fixture, not a fixed past
    // date — otherwise the dispatch history falls outside the rolling 24h lookback entirely.
    const NOW = new Date();
    const scheduler = fakeScheduler([{ campaign, decision: decisionFor(campaign) }]);
    const service = createService(scheduler, new FixedClock(NOW));

    const [plan] = await service.buildExecutionPlans();

    expect(plan.recommendedAction).toBe('DELAY');
    expect(plan.recommendedBatchSize).toBe(0);
    expect(plan.riskScore).toBeGreaterThanOrEqual(0.75);
    expect(plan.earliestExecutionAt.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it('recommends waiting for business hours even when the hard gate already allows dispatch', async () => {
    const NOW = new Date('2026-01-05T23:00:00.000Z'); // Monday, 23:00 — window-eligible, off business hours
    const campaign = buildRunningCampaign('33333333-3333-3333-3333-333333333333');
    const scheduler = fakeScheduler([{ campaign, decision: decisionFor(campaign) }]);
    const service = createService(scheduler, new FixedClock(NOW));

    const [plan] = await service.buildExecutionPlans();

    expect(plan.earliestExecutionAt).toEqual(NOW); // no hard blocker
    expect(plan.recommendedExecutionAt).toEqual(new Date('2026-01-06T08:00:00.000Z')); // next business morning
    expect(plan.recommendedAction).toBe('DELAY'); // advisory nudge still surfaces as DELAY
    const timingEntry = plan.decisionLog.find((entry) => entry.factor === 'INTELLIGENT_TIMING');
    expect(timingEntry?.explanation).toContain('advisory');
  });

  it('builds one plan per eligible campaign, preserving order from the Scheduler', async () => {
    const NOW = new Date('2026-01-05T10:00:00.000Z');
    const first = buildRunningCampaign('11111111-1111-1111-1111-111111111111');
    const second = buildRunningCampaign('22222222-2222-2222-2222-222222222222');
    const scheduler = fakeScheduler([
      { campaign: first, decision: decisionFor(first, 9) },
      { campaign: second, decision: decisionFor(second, 4) },
    ]);
    const service = createService(scheduler, new FixedClock(NOW));

    const plans = await service.buildExecutionPlans();

    expect(plans.map((plan) => plan.campaignId)).toEqual([first.id, second.id]);
    expect(plans.map((plan) => plan.executionPriority)).toEqual([9, 4]);
  });

  it('buildExecutionPlansWithEntities pairs each plan with its source Campaign', async () => {
    const NOW = new Date('2026-01-05T10:00:00.000Z');
    const campaign = buildRunningCampaign('55555555-5555-5555-5555-555555555555');
    const scheduler = fakeScheduler([{ campaign, decision: decisionFor(campaign) }]);
    const service = createService(scheduler, new FixedClock(NOW));

    const pairs = await service.buildExecutionPlansWithEntities();

    expect(pairs).toHaveLength(1);
    expect(pairs[0].campaign).toBe(campaign);
    expect(pairs[0].plan.campaignId).toBe(campaign.id);
  });

  it('honors an injected InboxProtectionStrategy binding, proving risk scoring is swappable without touching the service', async () => {
    const NOW = new Date('2026-01-05T10:00:00.000Z');
    const campaign = buildRunningCampaign('44444444-4444-4444-4444-444444444444');
    const scheduler = fakeScheduler([{ campaign, decision: decisionFor(campaign) }]);
    const alwaysHighRisk = {
      assess: () => ({ riskScore: 0.99, decision: { allowed: false, reasonCode: 'CUSTOM_DENY', explanation: 'custom strategy always denies' } }),
    };
    const service = new CampaignDispatcherService(
      scheduler,
      new FixedClock(NOW),
      new AdaptiveBatchSizePolicy(DEFAULT_DISPATCHER_CONFIG),
      alwaysHighRisk,
      new IntelligentTimingPolicy(DEFAULT_DISPATCHER_CONFIG),
      new DeliveryConfidencePolicy(DEFAULT_DISPATCHER_CONFIG),
      DEFAULT_DISPATCHER_CONFIG,
    );

    const [plan] = await service.buildExecutionPlans();

    expect(plan.riskScore).toBe(0.99);
    expect(plan.recommendedAction).toBe('DELAY');
    expect(plan.decisionLog[0].reasonCode).toBe('CUSTOM_DENY');
  });
});
