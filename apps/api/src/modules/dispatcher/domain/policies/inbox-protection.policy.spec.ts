import { CampaignOutcomeGoal, CampaignStrategyType, Weekday } from '@german-job-engine/shared-types';
import { InboxProtectionPolicy } from './inbox-protection.policy';
import { Campaign } from '../../../campaigns/domain/entities/campaign.entity';
import { CampaignName } from '../../../campaigns/domain/value-objects/campaign-name.vo';
import { CampaignGoal } from '../../../campaigns/domain/value-objects/campaign-goal.vo';
import { CampaignStrategyProfile } from '../../../campaigns/domain/value-objects/campaign-strategy-profile.vo';
import { SmartBatchPlan } from '../../../campaigns/domain/value-objects/smart-batch-plan.vo';
import { ExecutionWindow } from '../../../campaigns/domain/value-objects/execution-window.vo';
import { RateLimitProfile } from '../../../campaigns/domain/value-objects/rate-limit-profile.vo';
import { Actor } from '../../../campaigns/domain/value-objects/actor.vo';
import { CorrelationId } from '../../../campaigns/domain/value-objects/correlation-id.vo';
import { DEFAULT_DISPATCHER_CONFIG } from '../dispatcher-config';

const OWNER_ID = 'candidate-1';
const NOW = new Date('2026-01-05T12:00:00.000Z'); // a Monday

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
  successCount?: number;
  failureCount?: number;
  maxPerDay?: number;
  executionWindow?: ExecutionWindow;
}): Campaign {
  const successCount = options.successCount ?? 0;
  const failureCount = options.failureCount ?? 0;
  const totalTargets = successCount + failureCount + 1; // +1 spare, always at least one target

  const campaign = Campaign.create(
    '123e4567-e89b-12d3-a456-426614174000',
    OWNER_ID,
    CampaignName.create('Inbox protection fixture'),
    CampaignGoal.create({ targetApplicationCount: 5, desiredOutcome: CampaignOutcomeGoal.REPLIES }),
    CampaignStrategyProfile.create(CampaignStrategyType.BALANCED),
    SmartBatchPlan.create({ baseBatchSize: 5, minBatchSize: 1, maxBatchSize: 100 }),
    options.executionWindow ?? alwaysOpenWindow(),
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

describe('InboxProtectionPolicy', () => {
  const policy = new InboxProtectionPolicy(DEFAULT_DISPATCHER_CONFIG);

  it('allows a campaign with no dispatch history and reports zero risk', () => {
    const campaign = buildCampaign({});

    const assessment = policy.assess(campaign, NOW);

    expect(assessment.decision.allowed).toBe(true);
    expect(assessment.riskScore).toBe(0);
  });

  it('denies once the daily dispatch limit is already reached', () => {
    const campaign = buildCampaign({ successCount: 5, maxPerDay: 5 });
    // dispatchTarget() timestamps with the real wall clock, so the assessment instant must be
    // captured after building the fixture, not a fixed date — otherwise the dispatch attempts
    // fall outside the rolling 24h lookback window entirely (see Phase 4 M1's documented fix
    // for the same class of timing bug in campaign.entity.spec.ts).
    const now = new Date();

    const assessment = policy.assess(campaign, now);

    expect(assessment.decision.allowed).toBe(false);
    expect(assessment.decision.reasonCode).toBe('DAILY_LIMIT_EXCEEDED');
  });

  it('denies outside the execution window', () => {
    const narrowWindow = ExecutionWindow.create({
      allowedWeekdays: [Weekday.MONDAY],
      dailyStartHour: 8,
      dailyEndHour: 9,
      timezone: 'UTC',
    });
    const campaign = buildCampaign({ executionWindow: narrowWindow }); // NOW is 12:00, outside 08:00-09:00

    const assessment = policy.assess(campaign, NOW);

    expect(assessment.decision.allowed).toBe(false);
    expect(assessment.decision.reasonCode).toBe('OUTSIDE_EXECUTION_WINDOW');
  });

  it('denies when the composite risk score crosses the high-risk threshold', () => {
    // dailyUtilization = 9/10 = 0.9, failureRate = 15/24 = 0.625
    // risk = 0.6*0.9 + 0.4*0.625 = 0.54 + 0.25 = 0.79 >= 0.75
    const campaign = buildCampaign({ successCount: 9, failureCount: 15, maxPerDay: 10 });
    const now = new Date();

    const assessment = policy.assess(campaign, now);

    expect(assessment.decision.allowed).toBe(false);
    expect(assessment.decision.reasonCode).toBe('EXECUTION_RISK_TOO_HIGH');
    expect(assessment.riskScore).toBeCloseTo(0.79, 2);
  });

  it('allows a moderate-risk campaign below the threshold', () => {
    // dailyUtilization = 3/10 = 0.3, failureRate = 1/4 = 0.25
    // risk = 0.6*0.3 + 0.4*0.25 = 0.18 + 0.1 = 0.28
    const campaign = buildCampaign({ successCount: 3, failureCount: 1, maxPerDay: 10 });
    const now = new Date();

    const assessment = policy.assess(campaign, now);

    expect(assessment.decision.allowed).toBe(true);
    expect(assessment.riskScore).toBeCloseTo(0.28, 2);
  });
});
