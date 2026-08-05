import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CampaignsController } from './presentation/controllers/campaigns.controller';
import { CreateCampaignHandler } from './application/commands/create-campaign/create-campaign.handler';
import { UpdateCampaignHandler } from './application/commands/update-campaign/update-campaign.handler';
import { AddCampaignTargetHandler } from './application/commands/add-campaign-target/add-campaign-target.handler';
import { StartCampaignHandler } from './application/commands/start-campaign/start-campaign.handler';
import { PauseCampaignHandler } from './application/commands/pause-campaign/pause-campaign.handler';
import { ResumeCampaignHandler } from './application/commands/resume-campaign/resume-campaign.handler';
import { CancelCampaignHandler } from './application/commands/cancel-campaign/cancel-campaign.handler';
import { CompleteCampaignHandler } from './application/commands/complete-campaign/complete-campaign.handler';
import { RetryCampaignHandler } from './application/commands/retry-campaign/retry-campaign.handler';
import { ReplayCampaignHandler } from './application/commands/replay-campaign/replay-campaign.handler';
import { ArchiveCampaignHandler } from './application/commands/archive-campaign/archive-campaign.handler';
import { GetCampaignHandler } from './application/queries/get-campaign/get-campaign.handler';
import { ListCampaignsHandler } from './application/queries/list-campaigns/list-campaigns.handler';
import { SearchCampaignsHandler } from './application/queries/search-campaigns/search-campaigns.handler';
import { GetCampaignTimelineHandler } from './application/queries/get-campaign-timeline/get-campaign-timeline.handler';
import { GetCampaignHealthHandler } from './application/queries/get-campaign-health/get-campaign-health.handler';
import { GetCampaignExecutionStatusHandler } from './application/queries/get-campaign-execution-status/get-campaign-execution-status.handler';
import { CAMPAIGN_REPOSITORY } from './domain/repositories/campaign.repository.interface';
import { PrismaCampaignRepository } from './infrastructure/persistence/prisma-campaign.repository';

const commandHandlers = [
  CreateCampaignHandler,
  UpdateCampaignHandler,
  AddCampaignTargetHandler,
  StartCampaignHandler,
  PauseCampaignHandler,
  ResumeCampaignHandler,
  CancelCampaignHandler,
  CompleteCampaignHandler,
  RetryCampaignHandler,
  ReplayCampaignHandler,
  ArchiveCampaignHandler,
];

const queryHandlers = [
  GetCampaignHandler,
  ListCampaignsHandler,
  SearchCampaignsHandler,
  GetCampaignTimelineHandler,
  GetCampaignHealthHandler,
  GetCampaignExecutionStatusHandler,
];

@Module({
  imports: [CqrsModule],
  controllers: [CampaignsController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    { provide: CAMPAIGN_REPOSITORY, useClass: PrismaCampaignRepository },
  ],
  exports: [CAMPAIGN_REPOSITORY],
})
export class CampaignsModule {}
