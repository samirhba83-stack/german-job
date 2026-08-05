import { Inject } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { AddCampaignTargetCommand } from './add-campaign-target.command';
import { CAMPAIGN_REPOSITORY, CampaignRepository } from '../../../domain/repositories/campaign.repository.interface';
import { assertOwnerOrAdmin, buildActor, loadCampaignOrThrow, mapDomainError, resolveCorrelationId, saveAndPublish } from '../../campaign-command.helpers';
import { CampaignReadModel } from '../../read-models/campaign.read-model';
import { CampaignReadModelMapper } from '../../read-models/campaign-read-model.mapper';

/**
 * M26 — closes a real gap the architecture audit found: Campaign.addTarget() has existed since
 * Phase 4 M1 (see its own doc comment: "this method has zero live callers"), fully guarded
 * (DuplicateDetectionPolicy, CompanyFatiguePolicy) and tested, but no command handler or
 * controller endpoint ever called it. Without it, a campaign can never pass markReady()'s own
 * requireAtLeastOneTarget() guard — meaning no real campaign could ever legitimately reach
 * RUNNING at all, let alone have anything for the execution pipeline to act on. Not a redesign
 * of the Campaign Workspace or a new business rule: every check this handler relies on already
 * existed and was already tested; this is the one missing wire, exactly matching M26's own
 * charter ("connect the already-existing architectural modules... into one coherent system").
 */
@CommandHandler(AddCampaignTargetCommand)
export class AddCampaignTargetHandler implements ICommandHandler<AddCampaignTargetCommand> {
  constructor(
    @Inject(CAMPAIGN_REPOSITORY) private readonly campaignRepository: CampaignRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: AddCampaignTargetCommand): Promise<CampaignReadModel> {
    const campaign = await loadCampaignOrThrow(this.campaignRepository, command.campaignId);
    assertOwnerOrAdmin(campaign, command.actorRole, command.actorId);

    const actor = buildActor(command.actorRole, command.actorId);
    const correlationId = resolveCorrelationId(command.correlationId);

    try {
      campaign.addTarget(command.jobId, command.companyId, actor, correlationId);
    } catch (error) {
      mapDomainError(error);
    }

    await saveAndPublish(this.campaignRepository, this.eventBus, campaign);
    return CampaignReadModelMapper.toReadModel(campaign);
  }
}
