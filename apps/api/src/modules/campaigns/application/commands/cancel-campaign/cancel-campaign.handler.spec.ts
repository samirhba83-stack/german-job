import { ForbiddenException } from '@nestjs/common';
import { CampaignActorRole, CampaignOutcomeGoal, CampaignReasonCode, CampaignStrategyType, Weekday } from '@german-job-engine/shared-types';
import { CancelCampaignHandler } from './cancel-campaign.handler';
import { CancelCampaignCommand } from './cancel-campaign.command';
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

function draftCampaign(): Campaign {
  return Campaign.create(
    CAMPAIGN_ID,
    OWNER_ID,
    CampaignName.create('Campaign'),
    CampaignGoal.create({ targetApplicationCount: 5, desiredOutcome: CampaignOutcomeGoal.REPLIES }),
    CampaignStrategyProfile.create(CampaignStrategyType.BALANCED),
    SmartBatchPlan.create({ baseBatchSize: 5, minBatchSize: 1, maxBatchSize: 10 }),
    ExecutionWindow.create({ allowedWeekdays: [Weekday.MONDAY], dailyStartHour: 8, dailyEndHour: 18, timezone: 'Europe/Berlin' }),
    RateLimitProfile.default(),
    Actor.candidate(OWNER_ID),
    CorrelationId.create('corr-0'),
  );
}

describe('CancelCampaignHandler', () => {
  let campaignRepository: jest.Mocked<CampaignRepository>;
  let eventBus: { publish: jest.Mock };
  let handler: CancelCampaignHandler;

  beforeEach(() => {
    campaignRepository = {
      findById: jest.fn(),
      findByOwnerId: jest.fn(),
      search: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    eventBus = { publish: jest.fn() };
    handler = new CancelCampaignHandler(campaignRepository, eventBus as any);
  });

  it('cancels the campaign when the requester owns it', async () => {
    campaignRepository.findById.mockResolvedValue(draftCampaign());

    const result = await handler.execute(
      new CancelCampaignCommand(CAMPAIGN_ID, CampaignActorRole.CANDIDATE, OWNER_ID, CampaignReasonCode.CANDIDATE_REQUEST),
    );

    expect(result.status).toBe('CANCELLED');
    expect(campaignRepository.save).toHaveBeenCalledTimes(1);
  });

  it('refuses a non-owning, non-admin actor at the application layer, before the domain is even consulted', async () => {
    campaignRepository.findById.mockResolvedValue(draftCampaign());

    await expect(
      handler.execute(
        new CancelCampaignCommand(CAMPAIGN_ID, CampaignActorRole.CANDIDATE, 'someone-else', CampaignReasonCode.CANDIDATE_REQUEST),
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(campaignRepository.save).not.toHaveBeenCalled();
  });

  it('allows an admin to cancel on behalf of the owner', async () => {
    campaignRepository.findById.mockResolvedValue(draftCampaign());

    const result = await handler.execute(
      new CancelCampaignCommand(CAMPAIGN_ID, CampaignActorRole.ADMIN, 'admin-1', CampaignReasonCode.MANUAL_OVERRIDE),
    );
    expect(result.status).toBe('CANCELLED');
  });
});
