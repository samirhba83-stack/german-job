import { BadRequestException, Inject } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { UpdateCampaignCommand } from './update-campaign.command';
import { CAMPAIGN_REPOSITORY, CampaignRepository } from '../../../domain/repositories/campaign.repository.interface';
import { CampaignName } from '../../../domain/value-objects/campaign-name.vo';
import { CampaignGoal } from '../../../domain/value-objects/campaign-goal.vo';
import { CampaignStrategyProfile } from '../../../domain/value-objects/campaign-strategy-profile.vo';
import { SmartBatchPlan } from '../../../domain/value-objects/smart-batch-plan.vo';
import { ExecutionWindow } from '../../../domain/value-objects/execution-window.vo';
import { RateLimitProfile } from '../../../domain/value-objects/rate-limit-profile.vo';
import { Metadata } from '../../../domain/value-objects/metadata.vo';
import {
  assertOwnerOrAdmin,
  buildActor,
  loadCampaignOrThrow,
  mapDomainError,
  resolveCorrelationId,
  saveAndPublish,
} from '../../campaign-command.helpers';
import { CampaignReadModel } from '../../read-models/campaign.read-model';
import { CampaignReadModelMapper } from '../../read-models/campaign-read-model.mapper';

@CommandHandler(UpdateCampaignCommand)
export class UpdateCampaignHandler implements ICommandHandler<UpdateCampaignCommand> {
  constructor(
    @Inject(CAMPAIGN_REPOSITORY) private readonly campaignRepository: CampaignRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: UpdateCampaignCommand): Promise<CampaignReadModel> {
    const campaign = await loadCampaignOrThrow(this.campaignRepository, command.campaignId);
    assertOwnerOrAdmin(campaign, command.actorRole, command.actorId);

    const actor = buildActor(command.actorRole, command.actorId);
    const correlationId = resolveCorrelationId(command.correlationId);
    const { fields } = command;

    let updateFields: Parameters<typeof campaign.update>[0];
    try {
      updateFields = {
        name: fields.name ? CampaignName.create(fields.name) : undefined,
        goal: fields.goal ? CampaignGoal.create(fields.goal) : undefined,
        strategy: fields.strategy
          ? CampaignStrategyProfile.create(
              fields.strategy.type,
              fields.strategy.parameters ? Metadata.create(fields.strategy.parameters) : undefined,
            )
          : undefined,
        batchPlan: fields.batchPlan ? SmartBatchPlan.create(fields.batchPlan) : undefined,
        executionWindow: fields.executionWindow ? ExecutionWindow.create(fields.executionWindow) : undefined,
        rateLimitProfile: fields.rateLimitProfile ? RateLimitProfile.create(fields.rateLimitProfile) : undefined,
      };
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid campaign update data');
    }

    try {
      campaign.update(updateFields, actor, correlationId);
    } catch (error) {
      mapDomainError(error);
    }

    await saveAndPublish(this.campaignRepository, this.eventBus, campaign);
    return CampaignReadModelMapper.toReadModel(campaign);
  }
}
