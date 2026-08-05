import { CampaignOutcomeGoal, CampaignReasonCode, CampaignStrategyType, Weekday } from '@german-job-engine/shared-types';
import { CampaignEligibilityPolicy } from './campaign-eligibility.policy';
import { Campaign } from '../../../campaigns/domain/entities/campaign.entity';
import { CampaignName } from '../../../campaigns/domain/value-objects/campaign-name.vo';
import { CampaignGoal } from '../../../campaigns/domain/value-objects/campaign-goal.vo';
import { CampaignStrategyProfile } from '../../../campaigns/domain/value-objects/campaign-strategy-profile.vo';
import { SmartBatchPlan } from '../../../campaigns/domain/value-objects/smart-batch-plan.vo';
import { ExecutionWindow } from '../../../campaigns/domain/value-objects/execution-window.vo';
import { RateLimitProfile } from '../../../campaigns/domain/value-objects/rate-limit-profile.vo';
import { Actor } from '../../../campaigns/domain/value-objects/actor.vo';
import { CorrelationId } from '../../../campaigns/domain/value-objects/correlation-id.vo';
import { CooldownPeriod } from '../../../campaigns/domain/value-objects/cooldown-period.vo';

const OWNER_ID = 'candidate-1';

function correlationId(): CorrelationId {
  return CorrelationId.create('corr-1');
}

/** Open every day, all hours — isolates tests from incidental window rejection. */
function alwaysOpenWindow(): ExecutionWindow {
  return ExecutionWindow.create({
    allowedWeekdays: [
      Weekday.MONDAY,
      Weekday.TUESDAY,
      Weekday.WEDNESDAY,
      Weekday.THURSDAY,
      Weekday.FRIDAY,
      Weekday.SATURDAY,
      Weekday.SUNDAY,
    ],
    dailyStartHour: 0,
    dailyEndHour: 24,
    timezone: 'UTC',
    respectHolidays: false,
  });
}

function buildRunningCampaign(options: {
  targetCount?: number;
  batchPlan?: SmartBatchPlan;
  executionWindow?: ExecutionWindow;
  rateLimitProfile?: RateLimitProfile;
}): Campaign {
  const campaign = Campaign.create(
    '123e4567-e89b-12d3-a456-426614174000',
    OWNER_ID,
    CampaignName.create('Eligibility fixture'),
    CampaignGoal.create({ targetApplicationCount: 5, desiredOutcome: CampaignOutcomeGoal.REPLIES }),
    CampaignStrategyProfile.create(CampaignStrategyType.BALANCED),
    options.batchPlan ?? SmartBatchPlan.create({ baseBatchSize: 5, minBatchSize: 1, maxBatchSize: 10 }),
    options.executionWindow ?? alwaysOpenWindow(),
    options.rateLimitProfile ?? RateLimitProfile.default(),
    Actor.candidate(OWNER_ID),
    correlationId(),
  );

  const targetCount = options.targetCount ?? 1;
  for (let i = 0; i < targetCount; i += 1) {
    campaign.addTarget(`job-${i}`, `company-${i}`, Actor.candidate(OWNER_ID), correlationId());
  }
  campaign.markReady(Actor.candidate(OWNER_ID), correlationId());
  campaign.start(Actor.candidate(OWNER_ID), correlationId());
  return campaign;
}

describe('CampaignEligibilityPolicy', () => {
  const policy = new CampaignEligibilityPolicy();
  const NOW = new Date('2026-01-05T12:00:00.000Z'); // a Monday, well inside any all-day window

  it('denies a campaign that is not RUNNING', () => {
    const campaign = Campaign.create(
      '123e4567-e89b-12d3-a456-426614174000',
      OWNER_ID,
      CampaignName.create('Draft'),
      CampaignGoal.create({ targetApplicationCount: 5, desiredOutcome: CampaignOutcomeGoal.REPLIES }),
      CampaignStrategyProfile.create(CampaignStrategyType.BALANCED),
      SmartBatchPlan.create({ baseBatchSize: 5, minBatchSize: 1, maxBatchSize: 10 }),
      alwaysOpenWindow(),
      RateLimitProfile.default(),
      Actor.candidate(OWNER_ID),
      correlationId(),
    );

    const evaluation = policy.evaluate(campaign, NOW);

    expect(evaluation.decision.allowed).toBe(false);
    expect(evaluation.decision.reasonCode).toBe('NOT_RUNNING');
    expect(evaluation.plannedBatchSize).toBe(0);
  });

  it('denies a RUNNING campaign with no pending targets', () => {
    const campaign = buildRunningCampaign({ targetCount: 1 });
    const batch = campaign.planNextBatch(Actor.system('scheduler'), correlationId(), NOW);
    campaign.dispatchTarget(batch.targetIds[0], Actor.system('dispatcher'), correlationId());

    const evaluation = policy.evaluate(campaign, NOW);

    expect(evaluation.decision.reasonCode).toBe('NO_PENDING_TARGETS');
    expect(evaluation.plannedBatchSize).toBe(0);
  });

  it('denies a campaign that is actively cooling down', () => {
    const campaign = buildRunningCampaign({ targetCount: 1 });
    const until = new Date(NOW.getTime() + 60_000);
    campaign.enterCooldown(
      Actor.system('fatigue-monitor'),
      correlationId(),
      CooldownPeriod.create({ startedAt: NOW, until, reason: CampaignReasonCode.COMPANY_FATIGUE_DETECTED }),
    );

    const evaluation = policy.evaluate(campaign, NOW);

    expect(evaluation.decision.allowed).toBe(false);
    expect(evaluation.decision.reasonCode).toBe('COOLDOWN_ACTIVE');
    expect(evaluation.decision.explanation).toContain(until.toISOString());
    expect(evaluation.plannedBatchSize).toBe(0);
  });

  it('clears the cooldown and becomes eligible again once resumed back to RUNNING', () => {
    const campaign = buildRunningCampaign({ targetCount: 1 });
    campaign.enterCooldown(
      Actor.system('fatigue-monitor'),
      correlationId(),
      CooldownPeriod.create({
        startedAt: NOW,
        until: new Date(NOW.getTime() + 60_000),
        reason: CampaignReasonCode.COMPANY_FATIGUE_DETECTED,
      }),
    );
    campaign.resume(Actor.candidate(OWNER_ID), correlationId());
    campaign.confirmResume(Actor.candidate(OWNER_ID), correlationId());

    const evaluation = policy.evaluate(campaign, NOW);

    expect(campaign.cooldown).toBeNull();
    expect(evaluation.decision.allowed).toBe(true);
  });

  it('denies a campaign outside its execution window', () => {
    const narrowWindow = ExecutionWindow.create({
      allowedWeekdays: [Weekday.MONDAY],
      dailyStartHour: 8,
      dailyEndHour: 9,
      timezone: 'UTC',
    });
    const campaign = buildRunningCampaign({ targetCount: 1, executionWindow: narrowWindow });

    const evaluation = policy.evaluate(campaign, NOW); // NOW is 12:00, outside 08:00-09:00

    expect(evaluation.decision.reasonCode).toBe('OUTSIDE_EXECUTION_WINDOW');
    expect(evaluation.plannedBatchSize).toBe(0);
  });

  it('denies a campaign that has exhausted its daily rate limit', () => {
    const campaign = buildRunningCampaign({
      targetCount: 2,
      batchPlan: SmartBatchPlan.create({ baseBatchSize: 1, minBatchSize: 1, maxBatchSize: 2 }),
      rateLimitProfile: RateLimitProfile.create({ maxPerDay: 1, maxPerHour: 1, maxPerCompanyPerWindow: 1 }),
    });
    const batch = campaign.planNextBatch(Actor.system('scheduler'), correlationId(), NOW);
    campaign.dispatchTarget(batch.targetIds[0], Actor.system('dispatcher'), correlationId());
    const evaluationNow = new Date(); // captured after the real-wall-clock dispatch attempt

    const evaluation = policy.evaluate(campaign, evaluationNow);

    expect(evaluation.decision.reasonCode).toBe('RATE_LIMIT_EXHAUSTED');
    expect(evaluation.plannedBatchSize).toBe(0);
  });

  it('allows a fully eligible campaign and plans a batch capped by pending count, batch size, and remaining capacity', () => {
    const campaign = buildRunningCampaign({
      targetCount: 2,
      batchPlan: SmartBatchPlan.create({ baseBatchSize: 5, minBatchSize: 1, maxBatchSize: 10 }),
      rateLimitProfile: RateLimitProfile.default(),
    });

    const evaluation = policy.evaluate(campaign, NOW);

    expect(evaluation.decision.allowed).toBe(true);
    expect(evaluation.decision.reasonCode).toBe('ALLOWED');
    expect(evaluation.plannedBatchSize).toBe(2); // 2 pending targets < baseBatchSize(5) < remaining capacity(50)
  });
});
