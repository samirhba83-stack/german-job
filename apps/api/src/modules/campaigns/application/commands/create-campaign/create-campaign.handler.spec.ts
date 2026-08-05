import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CampaignActorRole, CampaignOutcomeGoal, CampaignStrategyType, Weekday } from '@german-job-engine/shared-types';
import { CreateCampaignHandler } from './create-campaign.handler';
import { CreateCampaignCommand } from './create-campaign.command';
import { CampaignRepository } from '../../../domain/repositories/campaign.repository.interface';

const VALID_INPUT = {
  ownerId: 'candidate-1',
  name: 'Berlin Backend Roles',
  goal: { targetApplicationCount: 10, desiredOutcome: CampaignOutcomeGoal.REPLIES },
  strategy: { type: CampaignStrategyType.BALANCED },
  batchPlan: { baseBatchSize: 5, minBatchSize: 1, maxBatchSize: 10 },
  executionWindow: {
    allowedWeekdays: [Weekday.MONDAY, Weekday.TUESDAY],
    dailyStartHour: 8,
    dailyEndHour: 18,
    timezone: 'Europe/Berlin',
  },
};

describe('CreateCampaignHandler', () => {
  let campaignRepository: jest.Mocked<CampaignRepository>;
  let eventBus: { publish: jest.Mock };
  let handler: CreateCampaignHandler;

  beforeEach(() => {
    campaignRepository = {
      findById: jest.fn(),
      findByOwnerId: jest.fn(),
      search: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    eventBus = { publish: jest.fn() };
    handler = new CreateCampaignHandler(campaignRepository, eventBus as any);
  });

  it('creates a draft campaign owned by the requesting candidate', async () => {
    const result = await handler.execute(
      new CreateCampaignCommand(
        VALID_INPUT.ownerId,
        VALID_INPUT.name,
        VALID_INPUT.goal,
        VALID_INPUT.strategy,
        VALID_INPUT.batchPlan,
        VALID_INPUT.executionWindow,
        CampaignActorRole.CANDIDATE,
        'candidate-1',
      ),
    );

    expect(campaignRepository.save).toHaveBeenCalledTimes(1);
    expect(eventBus.publish).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('DRAFT');
    expect(result.ownerId).toBe('candidate-1');
  });

  it('refuses a candidate creating a campaign owned by someone else', async () => {
    await expect(
      handler.execute(
        new CreateCampaignCommand(
          VALID_INPUT.ownerId,
          VALID_INPUT.name,
          VALID_INPUT.goal,
          VALID_INPUT.strategy,
          VALID_INPUT.batchPlan,
          VALID_INPUT.executionWindow,
          CampaignActorRole.CANDIDATE,
          'someone-else',
        ),
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(campaignRepository.save).not.toHaveBeenCalled();
  });

  it('allows an admin to create a campaign on behalf of a candidate', async () => {
    const result = await handler.execute(
      new CreateCampaignCommand(
        VALID_INPUT.ownerId,
        VALID_INPUT.name,
        VALID_INPUT.goal,
        VALID_INPUT.strategy,
        VALID_INPUT.batchPlan,
        VALID_INPUT.executionWindow,
        CampaignActorRole.ADMIN,
        'admin-1',
      ),
    );
    expect(result.ownerId).toBe(VALID_INPUT.ownerId);
  });

  it('translates invalid campaign data into BadRequestException', async () => {
    await expect(
      handler.execute(
        new CreateCampaignCommand(
          VALID_INPUT.ownerId,
          '',
          VALID_INPUT.goal,
          VALID_INPUT.strategy,
          VALID_INPUT.batchPlan,
          VALID_INPUT.executionWindow,
          CampaignActorRole.CANDIDATE,
          'candidate-1',
        ),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(campaignRepository.save).not.toHaveBeenCalled();
  });
});
