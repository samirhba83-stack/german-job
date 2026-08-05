import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CampaignActorRole, CampaignOutcomeGoal, CampaignStrategyType, Weekday } from '@german-job-engine/shared-types';
import { GetCampaignHandler } from './get-campaign.handler';
import { GetCampaignQuery } from './get-campaign.query';
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

describe('GetCampaignHandler', () => {
  let campaignRepository: jest.Mocked<CampaignRepository>;
  let handler: GetCampaignHandler;

  beforeEach(() => {
    campaignRepository = {
      findById: jest.fn(),
      findByOwnerId: jest.fn(),
      search: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    handler = new GetCampaignHandler(campaignRepository);
  });

  function seedCampaign() {
    campaignRepository.findById.mockResolvedValue(
      Campaign.create(
        CAMPAIGN_ID,
        'candidate-1',
        CampaignName.create('Campaign'),
        CampaignGoal.create({ targetApplicationCount: 5, desiredOutcome: CampaignOutcomeGoal.REPLIES }),
        CampaignStrategyProfile.create(CampaignStrategyType.BALANCED),
        SmartBatchPlan.create({ baseBatchSize: 5, minBatchSize: 1, maxBatchSize: 10 }),
        ExecutionWindow.create({ allowedWeekdays: [Weekday.MONDAY], dailyStartHour: 8, dailyEndHour: 18, timezone: 'Europe/Berlin' }),
        RateLimitProfile.default(),
        Actor.candidate('candidate-1'),
        CorrelationId.create('corr-0'),
      ),
    );
  }

  it('returns the read model for the owning candidate', async () => {
    seedCampaign();

    const result = await handler.execute(new GetCampaignQuery(CAMPAIGN_ID, CampaignActorRole.CANDIDATE, 'candidate-1'));

    expect(result.id).toBe(CAMPAIGN_ID);
    expect(result.status).toBe('DRAFT');
  });

  it('returns the read model for Admin regardless of ownership', async () => {
    seedCampaign();

    const result = await handler.execute(new GetCampaignQuery(CAMPAIGN_ID, CampaignActorRole.ADMIN, 'admin-1'));

    expect(result.id).toBe(CAMPAIGN_ID);
  });

  it('throws ForbiddenException for a different candidate', async () => {
    seedCampaign();

    await expect(
      handler.execute(new GetCampaignQuery(CAMPAIGN_ID, CampaignActorRole.CANDIDATE, 'candidate-2')),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws NotFoundException when the campaign does not exist', async () => {
    campaignRepository.findById.mockResolvedValue(null);
    await expect(
      handler.execute(new GetCampaignQuery(CAMPAIGN_ID, CampaignActorRole.ADMIN, 'admin-1')),
    ).rejects.toThrow(NotFoundException);
  });
});
