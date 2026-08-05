import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ActorRole, UserRole } from '@german-job-engine/shared-types';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator';
import { JwtPayload } from '../../../auth/application/dto/jwt-payload.interface';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { CreateApplicationCommand } from '../../application/commands/create-application/create-application.command';
import { PrepareApplicationCommand } from '../../application/commands/prepare-application/prepare-application.command';
import { QueueApplicationCommand } from '../../application/commands/queue-application/queue-application.command';
import { SendApplicationCommand } from '../../application/commands/send-application/send-application.command';
import { MarkDeliveredCommand } from '../../application/commands/mark-delivered/mark-delivered.command';
import { MarkOpenedCommand } from '../../application/commands/mark-opened/mark-opened.command';
import { MarkViewedCommand } from '../../application/commands/mark-viewed/mark-viewed.command';
import { RegisterCompanyReplyCommand } from '../../application/commands/register-company-reply/register-company-reply.command';
import { ScheduleInterviewCommand } from '../../application/commands/schedule-interview/schedule-interview.command';
import { CompleteInterviewCommand } from '../../application/commands/complete-interview/complete-interview.command';
import { ReceiveOfferCommand } from '../../application/commands/receive-offer/receive-offer.command';
import { SignContractCommand } from '../../application/commands/sign-contract/sign-contract.command';
import { RejectApplicationCommand } from '../../application/commands/reject-application/reject-application.command';
import { WithdrawApplicationCommand } from '../../application/commands/withdraw-application/withdraw-application.command';
import { ArchiveApplicationCommand } from '../../application/commands/archive-application/archive-application.command';
import { GetApplicationQuery } from '../../application/queries/get-application/get-application.query';
import { SearchApplicationsQuery } from '../../application/queries/search-applications/search-applications.query';
import { ListApplicationsQuery } from '../../application/queries/list-applications/list-applications.query';
import { GetTimelineQuery } from '../../application/queries/get-timeline/get-timeline.query';
import { GetApplicationHistoryQuery } from '../../application/queries/get-application-history/get-application-history.query';
import { CreateApplicationDto } from '../../application/dto/create-application.dto';
import { OptionalReasonDto } from '../../application/dto/optional-reason.dto';
import { RequiredReasonDto } from '../../application/dto/required-reason.dto';
import { TrackingSignalDto } from '../../application/dto/tracking-signal.dto';
import { RequiredMetadataDto } from '../../application/dto/required-metadata.dto';
import { OptionalMetadataDto } from '../../application/dto/optional-metadata.dto';
import { SearchApplicationsQueryDto } from '../../application/dto/search-applications.query.dto';
import { ListApplicationsQueryDto } from '../../application/dto/list-applications.query.dto';
import {
  ApplicationResponseDto,
  ApplicationHistoryEntryResponseDto,
  PaginatedApplicationsResponseDto,
  TimelineEntryResponseDto,
} from '../../application/dto/application-response.dto';

/** Maps the authenticated user's platform-wide UserRole to the Applications domain's own
 * ActorRole — the two are deliberately separate vocabularies (see Actor value object). */
function toActorRole(role: UserRole): ActorRole {
  switch (role) {
    case UserRole.CANDIDATE:
      return ActorRole.CANDIDATE;
    case UserRole.EMPLOYER:
      return ActorRole.COMPANY;
    case UserRole.ADMIN:
      return ActorRole.ADMIN;
    default:
      return ActorRole.ADMIN;
  }
}

@ApiTags('applications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('applications')
export class ApplicationsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @ApiOperation({ summary: 'Create a new application in DRAFT for the authenticated candidate' })
  @ApiResponse({ status: 201, type: ApplicationResponseDto })
  @UseGuards(RolesGuard)
  @Roles(UserRole.CANDIDATE)
  @Post()
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateApplicationDto): Promise<ApplicationResponseDto> {
    return this.commandBus.execute(
      new CreateApplicationCommand(
        user.sub,
        dto.jobId,
        dto.companyId,
        dto.snapshot,
        toActorRole(user.role),
        user.sub,
        dto.channelType,
        dto.campaignRef,
        dto.correlationId,
      ),
    );
  }

  @ApiOperation({ summary: "Search applications by candidate, job, company, status, channel or date range — ownership-scoped: Candidates see only their own, Employers must name a companyId they own" })
  @ApiResponse({ status: 200, type: PaginatedApplicationsResponseDto })
  @Get('search')
  async search(
    @CurrentUser() user: JwtPayload,
    @Query() query: SearchApplicationsQueryDto,
  ): Promise<PaginatedApplicationsResponseDto> {
    return this.queryBus.execute(
      new SearchApplicationsQuery(
        toActorRole(user.role),
        user.sub,
        query.candidateId,
        query.jobId,
        query.companyId,
        query.status,
        query.channelType,
        query.createdFrom,
        query.createdTo,
        query.page,
        query.limit,
      ),
    );
  }

  @ApiOperation({ summary: 'List every application, unfiltered and paginated — Admin only' })
  @ApiResponse({ status: 200, type: PaginatedApplicationsResponseDto })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get()
  async list(@Query() query: ListApplicationsQueryDto): Promise<PaginatedApplicationsResponseDto> {
    return this.queryBus.execute(new ListApplicationsQuery(query.page, query.limit));
  }

  @ApiOperation({ summary: 'Get an application by id — the owning Candidate, the owning Employer, or Admin only' })
  @ApiResponse({ status: 200, type: ApplicationResponseDto })
  @Get(':id')
  async getById(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<ApplicationResponseDto> {
    return this.queryBus.execute(new GetApplicationQuery(id, toActorRole(user.role), user.sub));
  }

  @ApiOperation({ summary: 'Get the raw, structured transition ledger for an application — the owning Candidate, the owning Employer, or Admin only' })
  @ApiResponse({ status: 200, type: [TimelineEntryResponseDto] })
  @Get(':id/timeline')
  async getTimeline(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<TimelineEntryResponseDto[]> {
    return this.queryBus.execute(new GetTimelineQuery(id, toActorRole(user.role), user.sub));
  }

  @ApiOperation({ summary: 'Get the narrative, human-readable history for an application — the owning Candidate, the owning Employer, or Admin only' })
  @ApiResponse({ status: 200, type: [ApplicationHistoryEntryResponseDto] })
  @Get(':id/history')
  async getHistory(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<ApplicationHistoryEntryResponseDto[]> {
    return this.queryBus.execute(new GetApplicationHistoryQuery(id, toActorRole(user.role), user.sub));
  }

  @ApiOperation({ summary: 'Mark a draft application ready to be queued for dispatch — owning Candidate only' })
  @ApiResponse({ status: 201, type: ApplicationResponseDto })
  @UseGuards(RolesGuard)
  @Roles(UserRole.CANDIDATE, UserRole.ADMIN)
  @Post(':id/prepare')
  async prepare(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: OptionalReasonDto,
  ): Promise<ApplicationResponseDto> {
    return this.commandBus.execute(
      new PrepareApplicationCommand(
        id,
        toActorRole(user.role),
        user.sub,
        dto.correlationId,
        dto.reasonCode,
        dto.reasonNote,
      ),
    );
  }

  @ApiOperation({ summary: 'Queue a prepared application for dispatch — owning Candidate only' })
  @ApiResponse({ status: 201, type: ApplicationResponseDto })
  @UseGuards(RolesGuard)
  @Roles(UserRole.CANDIDATE, UserRole.ADMIN)
  @Post(':id/queue')
  async queue(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: OptionalReasonDto,
  ): Promise<ApplicationResponseDto> {
    return this.commandBus.execute(
      new QueueApplicationCommand(
        id,
        toActorRole(user.role),
        user.sub,
        dto.correlationId,
        dto.reasonCode,
        dto.reasonNote,
      ),
    );
  }

  @ApiOperation({ summary: 'Dispatch a queued application — owning Candidate only' })
  @ApiResponse({ status: 201, type: ApplicationResponseDto })
  @UseGuards(RolesGuard)
  @Roles(UserRole.CANDIDATE, UserRole.ADMIN)
  @Post(':id/send')
  async send(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<ApplicationResponseDto> {
    return this.commandBus.execute(new SendApplicationCommand(id, toActorRole(user.role), user.sub));
  }

  @ApiOperation({ summary: 'Record a delivery tracking signal (internal/trusted callers only)' })
  @ApiResponse({ status: 201, type: ApplicationResponseDto })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':id/delivered')
  async markDelivered(@Param('id') id: string, @Body() dto: TrackingSignalDto): Promise<ApplicationResponseDto> {
    return this.commandBus.execute(
      new MarkDeliveredCommand(id, dto.evidenceType, dto.evidenceExternalId, dto.confidence, dto.evidenceUrl, dto.correlationId),
    );
  }

  @ApiOperation({ summary: 'Record an open tracking signal (internal/trusted callers only)' })
  @ApiResponse({ status: 201, type: ApplicationResponseDto })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':id/opened')
  async markOpened(@Param('id') id: string, @Body() dto: TrackingSignalDto): Promise<ApplicationResponseDto> {
    return this.commandBus.execute(
      new MarkOpenedCommand(id, dto.evidenceType, dto.evidenceExternalId, dto.confidence, dto.evidenceUrl, dto.correlationId),
    );
  }

  @ApiOperation({ summary: 'Record a view tracking signal (internal/trusted callers only)' })
  @ApiResponse({ status: 201, type: ApplicationResponseDto })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':id/viewed')
  async markViewed(@Param('id') id: string, @Body() dto: TrackingSignalDto): Promise<ApplicationResponseDto> {
    return this.commandBus.execute(
      new MarkViewedCommand(id, dto.evidenceType, dto.evidenceExternalId, dto.confidence, dto.evidenceUrl, dto.correlationId),
    );
  }

  @ApiOperation({ summary: "Register that the company replied to the application — the owning Employer or Admin only" })
  @ApiResponse({ status: 201, type: ApplicationResponseDto })
  @UseGuards(RolesGuard)
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @Post(':id/company-reply')
  async registerCompanyReply(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: OptionalReasonDto,
  ): Promise<ApplicationResponseDto> {
    return this.commandBus.execute(
      new RegisterCompanyReplyCommand(
        id,
        toActorRole(user.role),
        user.sub,
        dto.correlationId,
        dto.reasonCode,
        dto.reasonNote,
      ),
    );
  }

  @ApiOperation({ summary: 'Schedule an interview for the application — the owning Employer or Admin only' })
  @ApiResponse({ status: 201, type: ApplicationResponseDto })
  @UseGuards(RolesGuard)
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @Post(':id/interviews/schedule')
  async scheduleInterview(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: RequiredMetadataDto,
  ): Promise<ApplicationResponseDto> {
    return this.commandBus.execute(
      new ScheduleInterviewCommand(id, toActorRole(user.role), user.sub, dto.metadata, dto.correlationId),
    );
  }

  @ApiOperation({ summary: 'Complete a scheduled interview for the application — the owning Employer or Admin only' })
  @ApiResponse({ status: 201, type: ApplicationResponseDto })
  @UseGuards(RolesGuard)
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @Post(':id/interviews/complete')
  async completeInterview(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: OptionalMetadataDto,
  ): Promise<ApplicationResponseDto> {
    return this.commandBus.execute(
      new CompleteInterviewCommand(id, toActorRole(user.role), user.sub, dto.metadata, dto.correlationId),
    );
  }

  @ApiOperation({ summary: 'Record a received offer for the application — the owning Employer or Admin only' })
  @ApiResponse({ status: 201, type: ApplicationResponseDto })
  @UseGuards(RolesGuard)
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @Post(':id/offer')
  async receiveOffer(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: RequiredMetadataDto,
  ): Promise<ApplicationResponseDto> {
    return this.commandBus.execute(
      new ReceiveOfferCommand(id, toActorRole(user.role), user.sub, dto.metadata, dto.correlationId),
    );
  }

  @ApiOperation({ summary: 'Sign the contract for the application — owning Candidate only' })
  @ApiResponse({ status: 201, type: ApplicationResponseDto })
  @UseGuards(RolesGuard)
  @Roles(UserRole.CANDIDATE, UserRole.ADMIN)
  @Post(':id/contract')
  async signContract(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: OptionalMetadataDto,
  ): Promise<ApplicationResponseDto> {
    return this.commandBus.execute(
      new SignContractCommand(id, toActorRole(user.role), user.sub, dto.metadata, dto.correlationId),
    );
  }

  @ApiOperation({ summary: 'Reject the application — owning Employer or Admin only' })
  @ApiResponse({ status: 201, type: ApplicationResponseDto })
  @UseGuards(RolesGuard)
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @Post(':id/reject')
  async reject(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: RequiredReasonDto,
  ): Promise<ApplicationResponseDto> {
    return this.commandBus.execute(
      new RejectApplicationCommand(id, toActorRole(user.role), user.sub, dto.reasonCode, dto.reasonNote, dto.correlationId),
    );
  }

  @ApiOperation({ summary: 'Withdraw the application (owning candidate only)' })
  @ApiResponse({ status: 201, type: ApplicationResponseDto })
  @UseGuards(RolesGuard)
  @Roles(UserRole.CANDIDATE, UserRole.ADMIN)
  @Post(':id/withdraw')
  async withdraw(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: RequiredReasonDto,
  ): Promise<ApplicationResponseDto> {
    return this.commandBus.execute(
      new WithdrawApplicationCommand(id, toActorRole(user.role), user.sub, dto.reasonCode, dto.reasonNote, dto.correlationId),
    );
  }

  @ApiOperation({ summary: 'Archive the application — the owning Candidate, the owning Employer, or Admin only' })
  @ApiResponse({ status: 201, type: ApplicationResponseDto })
  @Post(':id/archive')
  async archive(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: OptionalReasonDto,
  ): Promise<ApplicationResponseDto> {
    return this.commandBus.execute(
      new ArchiveApplicationCommand(
        id,
        toActorRole(user.role),
        user.sub,
        dto.correlationId,
        dto.reasonCode,
        dto.reasonNote,
      ),
    );
  }
}
