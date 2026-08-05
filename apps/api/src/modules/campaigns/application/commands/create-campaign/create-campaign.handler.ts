import { randomUUID } from 'crypto';
import { BadRequestException, ForbiddenException, Inject } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { CampaignActorRole } from '@german-job-engine/shared-types';
import { CreateCampaignCommand } from './create-campaign.command';
import { CAMPAIGN_REPOSITORY, CampaignRepository } from '../../../domain/repositories/campaign.repository.interface';
import { Campaign } from '../../../domain/entities/campaign.entity';
import { CampaignName } from '../../../domain/value-objects/campaign-name.vo';
import { CampaignGoal } from '../../../domain/value-objects/campaign-goal.vo';
import { CampaignStrategyProfile } from '../../../domain/value-objects/campaign-strategy-profile.vo';
import { SmartBatchPlan } from '../../../domain/value-objects/smart-batch-plan.vo';
import { ExecutionWindow } from '../../../domain/value-objects/execution-window.vo';
import { RateLimitProfile } from '../../../domain/value-objects/rate-limit-profile.vo';
import { Metadata } from '../../../domain/value-objects/metadata.vo';
import { buildActor, resolveCorrelationId } from '../../campaign-command.helpers';
import { CampaignReadModel } from '../../read-models/campaign.read-model';
import { CampaignReadModelMapper } from '../../read-models/campaign-read-model.mapper';

@CommandHandler(CreateCampaignCommand)
export class CreateCampaignHandler implements ICommandHandler<CreateCampaignCommand> {
  constructor(
    @Inject(CAMPAIGN_REPOSITORY) private readonly campaignRepository: CampaignRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateCampaignCommand): Promise<CampaignReadModel> {
    if (command.actorRole === CampaignActorRole.CANDIDATE && command.actorId !== command.ownerId) {
      throw new ForbiddenException('A candidate may only create a campaign for themselves.');
    }

    let campaign: Campaign;
    try {
      const actor = buildActor(command.actorRole, command.actorId);
      const correlationId = resolveCorrelationId(command.correlationId);

      const name = CampaignName.create(command.name);
      const goal = CampaignGoal.create(command.goal);
      const strategy = CampaignStrategyProfile.create(
        command.strategy.type,
        command.strategy.parameters ? Metadata.create(command.strategy.parameters) : undefined,
      );
      const batchPlan = SmartBatchPlan.create(command.batchPlan);
      const executionWindow = ExecutionWindow.create(command.executionWindow);
      const rateLimitProfile = command.rateLimitProfile
        ? RateLimitProfile.create(command.rateLimitProfile)
        : RateLimitProfile.default();

      campaign = Campaign.create(
        randomUUID(),
        command.ownerId,
        name,
        goal,
        strategy,
        batchPlan,
        executionWindow,
        rateLimitProfile,
        actor,
        correlationId,
      );
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid campaign data');
    }

    await this.campaignRepository.save(campaign);
    campaign.domainEvents.forEach((event) => this.eventBus.publish(event));
    campaign.clearDomainEvents();

    return CampaignReadModelMapper.toReadModel(campaign);
  }
}
