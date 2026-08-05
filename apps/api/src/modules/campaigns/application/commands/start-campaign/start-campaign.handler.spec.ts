import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CampaignActorRole, CampaignOutcomeGoal, CampaignStrategyType, Weekday } from '@german-job-engine/shared-types';
import { StartCampaignHandler } from './start-campaign.handler';
import { StartCampaignCommand } from './start-campaign.command';
import { CampaignRepository } from '../../../domain/repositories/campaign.repository.interface';
import { Campaign } from '../../../domain/entities/campaign.entity';
import { CampaignName } from '../../../domain/value-objects/campaign-name.vo';
import { CampaignGoal } from '../../../domain/value-objects/campaign-goal.vo';
import { CampaignStrategyProfile } from '../../../domain/value-objects/campaign-strategy-profile.vo';
import { SmartBatchPlan } from '../../../domain/value-objects/smart-batch-plan.vo';
import { ExecutionWindow } from '../../../domain/value-objects/execution-window.vo';
import { RateLimitProfile } from '../../../domain/value-objects/rate-limit-profile.vo';
import { Actor } from '../../../domain/value-objects/actor.vo';
import { CorrelationId } from '../../../domain/value-objects/correlation-id.vo';

const CAMPAIGN_ID = '123e4567-e89b-12d3-a456-426614174000';
const OWNER_ID = 'candidate-1';

function draftCampaignWithTarget(): Campaign {
  const campaign = Campaign.create(
    CAMPAIGN_ID,
    OWNER_ID,
    CampaignName.create('Campaign'),
    CampaignGoal.create({ targetApplicationCount: 5, desiredOutcome: CampaignOutcomeGoal.REPLIES }),
    CampaignStrategyProfile.create(CampaignStrategyType.BALANCED),
    SmartBatchPlan.create({ baseBatchSize: 5, minBatchSize: 1, maxBatchSize: 10 }),
    ExecutionWindow.create({
      allowedWeekdays: [Weekday.MONDAY],
      dailyStartHour: 8,
      dailyEndHour: 18,
      timezone: 'Europe/Berlin',
    }),
    RateLimitProfile.default(),
    Actor.candidate(OWNER_ID),
    CorrelationId.create('corr-0'),
  );
  campaign.addTarget('job-1', 'company-1', Actor.candidate(OWNER_ID), CorrelationId.create('corr-0'));
  return campaign;
}

describe('StartCampaignHandler', () => {
  let campaignRepository: jest.Mocked<CampaignRepository>;
  let eventBus: { publish: jest.Mock };
  let handler: StartCampaignHandler;

  beforeEach(() => {
    campaignRepository = {
      findById: jest.fn(),
      findByOwnerId: jest.fn(),
      search: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    eventBus = { publish: jest.fn() };
    handler = new StartCampaignHandler(campaignRepository, eventBus as any);
  });

  it('marks a draft campaign ready and starts it in one orchestrated call', async () => {
    campaignRepository.findById.mockResolvedValue(draftCampaignWithTarget());

    const result = await handler.execute(new StartCampaignCommand(CAMPAIGN_ID, CampaignActorRole.CANDIDATE, OWNER_ID));

    expect(result.status).toBe('RUNNING');
    expect(campaignRepository.save).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — starting an already-running campaign is a no-op success', async () => {
    const campaign = draftCampaignWithTarget();
    campaign.markReady(Actor.candidate(OWNER_ID), CorrelationId.create('corr-0'));
    campaign.start(Actor.candidate(OWNER_ID), CorrelationId.create('corr-0'));
    campaignRepository.findById.mockResolvedValue(campaign);

    const result = await handler.execute(new StartCampaignCommand(CAMPAIGN_ID, CampaignActorRole.CANDIDATE, OWNER_ID));

    expect(result.status).toBe('RUNNING');
    expect(campaignRepository.save).not.toHaveBeenCalled();
  });

  it('throws NotFoundException for an unknown campaign', async () => {
    campaignRepository.findById.mockResolvedValue(null);
    await expect(handler.execute(new StartCampaignCommand(CAMPAIGN_ID, CampaignActorRole.CANDIDATE, OWNER_ID))).rejects.toThrow(
      NotFoundException,
    );
  });

  it('refuses a non-owning candidate', async () => {
    campaignRepository.findById.mockResolvedValue(draftCampaignWithTarget());
    await expect(
      handler.execute(new StartCampaignCommand(CAMPAIGN_ID, CampaignActorRole.CANDIDATE, 'someone-else')),
    ).rejects.toThrow(ForbiddenException);
    expect(campaignRepository.save).not.toHaveBeenCalled();
  });
});
