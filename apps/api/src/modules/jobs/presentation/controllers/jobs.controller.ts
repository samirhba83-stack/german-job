import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@german-job-engine/shared-types';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator';
import { JwtPayload } from '../../../auth/application/dto/jwt-payload.interface';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { CreateJobCommand } from '../../application/commands/create-job/create-job.command';
import { UpdateJobCommand } from '../../application/commands/update-job/update-job.command';
import { PublishJobCommand } from '../../application/commands/publish-job/publish-job.command';
import { ArchiveJobCommand } from '../../application/commands/archive-job/archive-job.command';
import { CloseJobCommand } from '../../application/commands/close-job/close-job.command';
import { ReopenJobCommand } from '../../application/commands/reopen-job/reopen-job.command';
import { GetJobQuery } from '../../application/queries/get-job/get-job.query';
import { ListJobsQuery } from '../../application/queries/list-jobs/list-jobs.query';
import { SearchJobsQuery } from '../../application/queries/search-jobs/search-jobs.query';
import { CreateJobDto } from '../../application/dto/create-job.dto';
import { UpdateJobDto } from '../../application/dto/update-job.dto';
import { SearchJobsQueryDto } from '../../application/dto/search-jobs.query.dto';
import { ListJobsQueryDto } from '../../application/dto/list-jobs.query.dto';
import { JobResponseDto } from '../../application/dto/job-response.dto';
import { PaginatedJobsResponseDto } from '../../application/dto/paginated-jobs-response.dto';

@ApiTags('jobs')
@Controller('jobs')
export class JobsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a draft job under the authenticated employer\'s company' })
  @ApiResponse({ status: 201, type: JobResponseDto })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @Post()
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateJobDto): Promise<JobResponseDto> {
    return this.commandBus.execute(new CreateJobCommand(user.sub, dto));
  }

  @ApiOperation({ summary: 'Search published jobs by keyword and filters' })
  @ApiResponse({ status: 200, type: PaginatedJobsResponseDto })
  @Get('search')
  async search(@Query() query: SearchJobsQueryDto): Promise<PaginatedJobsResponseDto> {
    return this.queryBus.execute(
      new SearchJobsQuery(
        query.keyword,
        query.city,
        query.companyId,
        query.industry,
        query.minSalary,
        query.employmentType,
        query.contractType,
        query.remotePolicy,
        query.visaSponsorship,
        query.ausbildungOnly,
        query.germanLevel,
        query.page,
        query.limit,
      ),
    );
  }

  @ApiOperation({ summary: 'List published jobs, paginated' })
  @ApiResponse({ status: 200, type: PaginatedJobsResponseDto })
  @Get()
  async list(@Query() query: ListJobsQueryDto): Promise<PaginatedJobsResponseDto> {
    return this.queryBus.execute(new ListJobsQuery(query.page, query.limit));
  }

  @ApiOperation({ summary: 'Get a job by id' })
  @ApiResponse({ status: 200, type: JobResponseDto })
  @Get(':id')
  async getById(@Param('id') id: string): Promise<JobResponseDto> {
    return this.queryBus.execute(new GetJobQuery(id));
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a job (owning company or admin only)' })
  @ApiResponse({ status: 200, type: JobResponseDto })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateJobDto,
  ): Promise<JobResponseDto> {
    return this.commandBus.execute(new UpdateJobCommand(id, user.sub, user.role, dto));
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publish a draft job (owning company or admin only)' })
  @ApiResponse({ status: 201, type: JobResponseDto })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @Post(':id/publish')
  async publish(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<JobResponseDto> {
    return this.commandBus.execute(new PublishJobCommand(id, user.sub, user.role));
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Archive a job (owning company or admin only)' })
  @ApiResponse({ status: 201, type: JobResponseDto })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @Post(':id/archive')
  async archive(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<JobResponseDto> {
    return this.commandBus.execute(new ArchiveJobCommand(id, user.sub, user.role));
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Close a published job (owning company or admin only)' })
  @ApiResponse({ status: 201, type: JobResponseDto })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @Post(':id/close')
  async close(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<JobResponseDto> {
    return this.commandBus.execute(new CloseJobCommand(id, user.sub, user.role));
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reopen an archived or closed job (owning company or admin only)' })
  @ApiResponse({ status: 201, type: JobResponseDto })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @Post(':id/reopen')
  async reopen(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<JobResponseDto> {
    return this.commandBus.execute(new ReopenJobCommand(id, user.sub, user.role));
  }
}
