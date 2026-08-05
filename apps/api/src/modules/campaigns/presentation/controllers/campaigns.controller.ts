import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CampaignActorRole, UserRole } from '@german-job-engine/shared-types';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator';
import { JwtPayload } from '../../../auth/application/dto/jwt-payload.interface';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { CreateCampaignCommand } from '../../application/commands/create-campaign/create-campaign.command';
import { UpdateCampaignCommand } from '../../application/commands/update-campaign/update-campaign.command';
import { AddCampaignTargetCommand } from '../../application/commands/add-campaign-target/add-campaign-target.command';
import { StartCampaignCommand } from '../../application/commands/start-campaign/start-campaign.command';
import { PauseCampaignCommand } from '../../application/commands/pause-campaign/pause-campaign.command';
import { ResumeCampaignCommand } from '../../application/commands/resume-campaign/resume-campaign.command';
import { CancelCampaignCommand } from '../../application/commands/cancel-campaign/cancel-campaign.command';
import { CompleteCampaignCommand } from '../../application/commands/complete-campaign/complete-campaign.command';
import { RetryCampaignCommand } from '../../application/commands/retry-campaign/retry-campaign.command';
import { ReplayCampaignCommand } from '../../application/commands/replay-campaign/replay-campaign.command';
import { ArchiveCampaignCommand } from '../../application/commands/archive-campaign/archive-campaign.command';
import { GetCampaignQuery } from '../../application/queries/get-campaign/get-campaign.query';
import { ListCampaignsQuery } from '../../application/queries/list-campaigns/list-campaigns.query';
import { SearchCampaignsQuery } from '../../application/queries/search-campaigns/search-campaigns.query';
import { GetCampaignTimelineQuery } from '../../application/queries/get-campaign-timeline/get-campaign-timeline.query';
import { GetCampaignHealthQuery } from '../../application/queries/get-campaign-health/get-campaign-health.query';
import { GetCampaignExecutionStatusQuery } from '../../application/queries/get-campaign-execution-status/get-campaign-execution-status.query';
import { CreateCampaignDto } from '../../application/dto/create-campaign.dto';
import { AddCampaignTargetDto } from '../../application/dto/add-campaign-target.dto';
import { UpdateCampaignDto } from '../../application/dto/update-campaign.dto';
import { OptionalCampaignReasonDto } from '../../application/dto/optional-campaign-reason.dto';
import { RequiredCampaignReasonDto } from '../../application/dto/required-campaign-reason.dto';
import { RetryCampaignDto } from '../../application/dto/retry-campaign.dto';
import { ReplayCampaignDto } from '../../application/dto/replay-campaign.dto';
import { SearchCampaignsQueryDto } from '../../application/dto/search-campaigns.query.dto';
import { ListCampaignsQueryDto } from '../../application/dto/list-campaigns.query.dto';
import {
  CampaignResponseDto,
  CampaignTimelineEntryResponseDto,
  CampaignHealthResponseDto,
  CampaignExecutionStatusResponseDto,
  PaginatedCampaignsResponseDto,
} from '../../application/dto/campaign-response.dto';

/** Maps the authenticated user's platform-wide UserRole to the Campaign domain's own
 * CampaignActorRole — deliberately separate vocabularies (see Actor value object). Only
 * CANDIDATE and ADMIN are ever routed here; EMPLOYER has no place acting on a campaign. */
function toActorRole(role: UserRole): CampaignActorRole {
  return role === UserRole.CANDIDATE ? CampaignActorRole.CANDIDATE : CampaignActorRole.ADMIN;
}

@ApiTags('campaigns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CANDIDATE, UserRole.ADMIN)
@Controller('campaigns')
export class CampaignsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @ApiOperation({ summary: 'Create a new campaign in DRAFT, owned by the authenticated candidate' })
  @ApiResponse({ status: 201, type: CampaignResponseDto })
  @Post()
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateCampaignDto): Promise<CampaignResponseDto> {
    return this.commandBus.execute(
      new CreateCampaignCommand(
        user.sub,
        dto.name,
        dto.goal,
        dto.strategy,
        dto.batchPlan,
        dto.executionWindow,
        toActorRole(user.role),
        user.sub,
        dto.rateLimitProfile,
        dto.correlationId,
      ),
    );
  }

  @ApiOperation({ summary: 'Search campaigns by owner, status, strategy, or date range — ownership-scoped: a Candidate always sees only their own' })
  @ApiResponse({ status: 200, type: PaginatedCampaignsResponseDto })
  @Get('search')
  async search(
    @CurrentUser() user: JwtPayload,
    @Query() query: SearchCampaignsQueryDto,
  ): Promise<PaginatedCampaignsResponseDto> {
    return this.queryBus.execute(
      new SearchCampaignsQuery(
        toActorRole(user.role),
        user.sub,
        query.ownerId,
        query.status,
        query.strategyType,
        query.createdFrom,
        query.createdTo,
        query.page,
        query.limit,
      ),
    );
  }

  @ApiOperation({ summary: 'List campaigns, optionally scoped to an owner, paginated — ownership-scoped: a Candidate always sees only their own' })
  @ApiResponse({ status: 200, type: PaginatedCampaignsResponseDto })
  @Get()
  async list(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListCampaignsQueryDto,
  ): Promise<PaginatedCampaignsResponseDto> {
    return this.queryBus.execute(new ListCampaignsQuery(toActorRole(user.role), user.sub, query.ownerId, query.page, query.limit));
  }

  @ApiOperation({ summary: 'Get a campaign by id — owning candidate or admin only' })
  @ApiResponse({ status: 200, type: CampaignResponseDto })
  @Get(':id')
  async getById(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<CampaignResponseDto> {
    return this.queryBus.execute(new GetCampaignQuery(id, toActorRole(user.role), user.sub));
  }

  @ApiOperation({ summary: 'Get the structured transition ledger for a campaign — owning candidate or admin only' })
  @ApiResponse({ status: 200, type: [CampaignTimelineEntryResponseDto] })
  @Get(':id/timeline')
  async getTimeline(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<CampaignTimelineEntryResponseDto[]> {
    return this.queryBus.execute(new GetCampaignTimelineQuery(id, toActorRole(user.role), user.sub));
  }

  @ApiOperation({ summary: 'Get the reserved health assessment for a campaign, if any has been recorded — owning candidate or admin only' })
  @ApiResponse({ status: 200, type: CampaignHealthResponseDto })
  @Get(':id/health')
  async getHealth(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<CampaignHealthResponseDto | null> {
    return this.queryBus.execute(new GetCampaignHealthQuery(id, toActorRole(user.role), user.sub));
  }

  @ApiOperation({ summary: 'Get the current execution status: active batch, target breakdown, checkpoint, goal progress — owning candidate or admin only' })
  @ApiResponse({ status: 200, type: CampaignExecutionStatusResponseDto })
  @Get(':id/execution-status')
  async getExecutionStatus(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<CampaignExecutionStatusResponseDto> {
    return this.queryBus.execute(new GetCampaignExecutionStatusQuery(id, toActorRole(user.role), user.sub));
  }

  @ApiOperation({ summary: 'Update a campaign while it is still DRAFT or READY (owning candidate or admin only)' })
  @ApiResponse({ status: 200, type: CampaignResponseDto })
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateCampaignDto,
  ): Promise<CampaignResponseDto> {
    return this.commandBus.execute(
      new UpdateCampaignCommand(
        id,
        toActorRole(user.role),
        user.sub,
        {
          name: dto.name,
          goal: dto.goal,
          strategy: dto.strategy,
          batchPlan: dto.batchPlan,
          executionWindow: dto.executionWindow,
          rateLimitProfile: dto.rateLimitProfile,
        },
        dto.correlationId,
      ),
    );
  }

  @ApiOperation({ summary: 'Add a target (job + company) to a campaign — required before it can become READY/RUNNING' })
  @ApiResponse({ status: 201, type: CampaignResponseDto })
  @Post(':id/targets')
  async addTarget(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: AddCampaignTargetDto,
  ): Promise<CampaignResponseDto> {
    return this.commandBus.execute(
      new AddCampaignTargetCommand(id, dto.jobId, dto.companyId, toActorRole(user.role), user.sub, dto.correlationId),
    );
  }

  @ApiOperation({ summary: 'Start a campaign (marks ready first if still draft); idempotent if already running' })
  @ApiResponse({ status: 201, type: CampaignResponseDto })
  @Post(':id/start')
  async start(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<CampaignResponseDto> {
    return this.commandBus.execute(new StartCampaignCommand(id, toActorRole(user.role), user.sub));
  }

  @ApiOperation({ summary: 'Pause a running campaign; idempotent if already paused' })
  @ApiResponse({ status: 201, type: CampaignResponseDto })
  @Post(':id/pause')
  async pause(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: OptionalCampaignReasonDto,
  ): Promise<CampaignResponseDto> {
    return this.commandBus.execute(
      new PauseCampaignCommand(id, toActorRole(user.role), user.sub, dto.correlationId, dto.reasonCode, dto.reasonNote),
    );
  }

  @ApiOperation({ summary: 'Resume a paused, cooling-down, or stopped campaign back to running; idempotent if already running' })
  @ApiResponse({ status: 201, type: CampaignResponseDto })
  @Post(':id/resume')
  async resume(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: OptionalCampaignReasonDto,
  ): Promise<CampaignResponseDto> {
    return this.commandBus.execute(
      new ResumeCampaignCommand(id, toActorRole(user.role), user.sub, dto.correlationId, dto.reasonCode, dto.reasonNote),
    );
  }

  @ApiOperation({ summary: 'Cancel a campaign (owning candidate or admin only, mandatory reason)' })
  @ApiResponse({ status: 201, type: CampaignResponseDto })
  @Post(':id/cancel')
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: RequiredCampaignReasonDto,
  ): Promise<CampaignResponseDto> {
    return this.commandBus.execute(
      new CancelCampaignCommand(id, toActorRole(user.role), user.sub, dto.reasonCode, dto.reasonNote, dto.correlationId),
    );
  }

  @ApiOperation({ summary: 'Mark a running campaign completed; idempotent if already completed' })
  @ApiResponse({ status: 201, type: CampaignResponseDto })
  @Post(':id/complete')
  async complete(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<CampaignResponseDto> {
    return this.commandBus.execute(new CompleteCampaignCommand(id, toActorRole(user.role), user.sub));
  }

  @ApiOperation({ summary: 'Retry failed targets up to the retry policy\'s max attempt count' })
  @ApiResponse({ status: 201, type: CampaignResponseDto })
  @Post(':id/retry')
  async retry(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: RetryCampaignDto,
  ): Promise<CampaignResponseDto> {
    return this.commandBus.execute(new RetryCampaignCommand(id, toActorRole(user.role), user.sub, dto.maxAttempts, dto.correlationId));
  }

  @ApiOperation({ summary: 'Replay targets within a scope; never re-includes an already-dispatched target' })
  @ApiResponse({ status: 201, type: CampaignResponseDto })
  @Post(':id/replay')
  async replay(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ReplayCampaignDto,
  ): Promise<CampaignResponseDto> {
    return this.commandBus.execute(
      new ReplayCampaignCommand(id, toActorRole(user.role), user.sub, dto.scope, dto.targetIds, dto.correlationId),
    );
  }

  @ApiOperation({ summary: 'Archive a campaign; idempotent if already archived' })
  @ApiResponse({ status: 201, type: CampaignResponseDto })
  @Post(':id/archive')
  async archive(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: OptionalCampaignReasonDto,
  ): Promise<CampaignResponseDto> {
    return this.commandBus.execute(
      new ArchiveCampaignCommand(id, toActorRole(user.role), user.sub, dto.correlationId, dto.reasonCode, dto.reasonNote),
    );
  }
}
