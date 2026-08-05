import { CampaignOutcomeGoal, CampaignStatus, CampaignStrategyType, Weekday } from '@german-job-engine/shared-types';
import { CampaignSchedulerService } from './campaign-scheduler.service';
import { Campaign } from '../../../campaigns/domain/entities/campaign.entity';
import { CampaignRepository, CampaignSearchResult } from '../../../campaigns/domain/repositories/campaign.repository.interface';
import { CampaignName } from '../../../campaigns/domain/value-objects/campaign-name.vo';
import { CampaignGoal } from '../../../campaigns/domain/value-objects/campaign-goal.vo';
import { CampaignStrategyProfile } from '../../../campaigns/domain/value-objects/campaign-strategy-profile.vo';
import { SmartBatchPlan } from '../../../campaigns/domain/value-objects/smart-batch-plan.vo';
import { ExecutionWindow } from '../../../campaigns/domain/value-objects/execution-window.vo';
import { RateLimitProfile } from '../../../campaigns/domain/value-objects/rate-limit-profile.vo';
import { Actor } from '../../../campaigns/domain/value-objects/actor.vo';
import { CorrelationId } from '../../../campaigns/domain/value-objects/correlation-id.vo';
import { FixedClock } from '../../../execution/infrastructure/clock/fixed-clock';
import { CampaignEligibilityPolicy } from '../../domain/policies/campaign-eligibility.policy';
import { CampaignPriorityPolicy } from '../../domain/policies/campaign-priority.policy';
import { DEFAULT_SCHEDULER_CONFIG } from '../../domain/scheduler-config';

const NOW = new Date('2026-01-05T12:00:00.000Z'); // a Monday

function createService(repository: CampaignRepository, now: Date = NOW): CampaignSchedulerService {
  return new CampaignSchedulerService(
    repository,
    new FixedClock(now),
    new CampaignEligibilityPolicy(),
    new CampaignPriorityPolicy(DEFAULT_SCHEDULER_CONFIG),
  );
}

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

function buildEligibleCampaign(id: string, strategyType: CampaignStrategyType): Campaign {
  const campaign = Campaign.create(
    id,
    'candidate-1',
    CampaignName.create(`Campaign ${id}`),
    CampaignGoal.create({ targetApplicationCount: 5, desiredOutcome: CampaignOutcomeGoal.REPLIES }),
    CampaignStrategyProfile.create(strategyType),
    SmartBatchPlan.create({ baseBatchSize: 5, minBatchSize: 1, maxBatchSize: 10 }),
    alwaysOpenWindow(),
    RateLimitProfile.default(),
    Actor.candidate('candidate-1'),
    CorrelationId.create('corr-0'),
  );
  campaign.addTarget('job-1', 'company-1', Actor.candidate('candidate-1'), CorrelationId.create('corr-0'));
  campaign.markReady(Actor.candidate('candidate-1'), CorrelationId.create('corr-0'));
  campaign.start(Actor.candidate('candidate-1'), CorrelationId.create('corr-0'));
  return campaign;
}

function buildIneligibleCampaign(id: string): Campaign {
  const campaign = buildEligibleCampaign(id, CampaignStrategyType.BALANCED);
  const batch = campaign.planNextBatch(Actor.system('scheduler'), CorrelationId.create('corr-0'), NOW);
  campaign.dispatchTarget(batch.targetIds[0], Actor.system('dispatcher'), CorrelationId.create('corr-0'));
  return campaign; // RUNNING, but zero pending targets left -> NO_PENDING_TARGETS
}

function fakeRepository(pages: CampaignSearchResult[]): CampaignRepository {
  const search = jest.fn();
  pages.forEach((page) => search.mockImplementationOnce(() => Promise.resolve(page)));
  return { search } as unknown as CampaignRepository;
}

describe('CampaignSchedulerService', () => {
  it('ranks eligible campaigns before ineligible ones, and eligible ones by priority descending', async () => {
    const aggressive = buildEligibleCampaign('11111111-1111-1111-1111-111111111111', CampaignStrategyType.AGGRESSIVE);
    const conservative = buildEligibleCampaign('22222222-2222-2222-2222-222222222222', CampaignStrategyType.CONSERVATIVE);
    const ineligible = buildIneligibleCampaign('33333333-3333-3333-3333-333333333333');
    const repository = fakeRepository([{ items: [conservative, ineligible, aggressive], total: 3 }]);
    const service = createService(repository);

    const decisions = await service.evaluateAll();

    expect(decisions.map((decision) => decision.campaignId)).toEqual([aggressive.id, conservative.id, ineligible.id]);
    expect(decisions[0].eligible).toBe(true);
    expect(decisions[2].eligible).toBe(false);
    expect(decisions[2].reasonCode).toBe('NO_PENDING_TARGETS');
  });

  it('getEligibleCampaigns returns only the eligible subset', async () => {
    const aggressive = buildEligibleCampaign('11111111-1111-1111-1111-111111111111', CampaignStrategyType.AGGRESSIVE);
    const ineligible = buildIneligibleCampaign('33333333-3333-3333-3333-333333333333');
    const repository = fakeRepository([{ items: [ineligible, aggressive], total: 2 }]);
    const service = createService(repository);

    const eligible = await service.getEligibleCampaigns();

    expect(eligible).toHaveLength(1);
    expect(eligible[0].campaignId).toBe(aggressive.id);
    expect(eligible[0].nextExecutionAt).toEqual(NOW);
  });

  it('getEligibleCampaignsWithEntities pairs each decision with its source Campaign', async () => {
    const aggressive = buildEligibleCampaign('11111111-1111-1111-1111-111111111111', CampaignStrategyType.AGGRESSIVE);
    const ineligible = buildIneligibleCampaign('33333333-3333-3333-3333-333333333333');
    const repository = fakeRepository([{ items: [ineligible, aggressive], total: 2 }]);
    const service = createService(repository);

    const pairs = await service.getEligibleCampaignsWithEntities();

    expect(pairs).toHaveLength(1);
    expect(pairs[0].campaign).toBe(aggressive);
    expect(pairs[0].decision.campaignId).toBe(aggressive.id);
  });

  it('pages through the repository until every RUNNING campaign has been fetched', async () => {
    const first = buildEligibleCampaign('11111111-1111-1111-1111-111111111111', CampaignStrategyType.BALANCED);
    const second = buildEligibleCampaign('22222222-2222-2222-2222-222222222222', CampaignStrategyType.BALANCED);
    const repository = fakeRepository([
      { items: [first], total: 2 },
      { items: [second], total: 2 },
    ]);
    const service = createService(repository);

    const decisions = await service.evaluateAll();

    expect(repository.search).toHaveBeenCalledTimes(2);
    expect(decisions.map((decision) => decision.campaignId).sort()).toEqual([first.id, second.id].sort());
    const firstCallSpec = (repository.search as jest.Mock).mock.calls[0][0];
    expect(firstCallSpec.status).toBe(CampaignStatus.RUNNING);
    expect(firstCallSpec.page).toBe(1);
    const secondCallSpec = (repository.search as jest.Mock).mock.calls[1][0];
    expect(secondCallSpec.page).toBe(2);
  });

  it('stops paging immediately when the repository has no RUNNING campaigns', async () => {
    const repository = fakeRepository([{ items: [], total: 0 }]);
    const service = createService(repository);

    const decisions = await service.evaluateAll();

    expect(decisions).toEqual([]);
    expect(repository.search).toHaveBeenCalledTimes(1);
  });
});
