import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@german-job-engine/shared-types';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator';
import { JwtPayload } from '../../../auth/application/dto/jwt-payload.interface';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { CreateCompanyCommand } from '../../application/commands/create-company/create-company.command';
import { UpdateCompanyCommand } from '../../application/commands/update-company/update-company.command';
import { ArchiveCompanyCommand } from '../../application/commands/archive-company/archive-company.command';
import { RestoreCompanyCommand } from '../../application/commands/restore-company/restore-company.command';
import { GetCompanyQuery } from '../../application/queries/get-company/get-company.query';
import { SearchCompaniesQuery } from '../../application/queries/search-companies/search-companies.query';
import { ListCompaniesQuery } from '../../application/queries/list-companies/list-companies.query';
import { CreateCompanyDto } from '../../application/dto/create-company.dto';
import { UpdateCompanyDto } from '../../application/dto/update-company.dto';
import { SearchCompaniesQueryDto } from '../../application/dto/search-companies.query.dto';
import { ListCompaniesQueryDto } from '../../application/dto/list-companies.query.dto';
import { CompanyResponseDto } from '../../application/dto/company-response.dto';
import { PaginatedCompaniesResponseDto } from '../../application/dto/paginated-companies-response.dto';

@ApiTags('companies')
@Controller('companies')
export class CompaniesController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create the company profile owned by the authenticated employer' })
  @ApiResponse({ status: 201, type: CompanyResponseDto })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @Post()
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateCompanyDto,
  ): Promise<CompanyResponseDto> {
    return this.commandBus.execute(new CreateCompanyCommand(user.sub, dto));
  }

  @ApiOperation({ summary: 'Search active companies by keyword and filters' })
  @ApiResponse({ status: 200, type: PaginatedCompaniesResponseDto })
  @Get('search')
  async search(@Query() query: SearchCompaniesQueryDto): Promise<PaginatedCompaniesResponseDto> {
    return this.queryBus.execute(
      new SearchCompaniesQuery(
        query.keyword,
        query.industry,
        query.size,
        query.city,
        query.visaSponsorship,
        query.page,
        query.limit,
      ),
    );
  }

  @ApiOperation({ summary: 'List active companies, paginated' })
  @ApiResponse({ status: 200, type: PaginatedCompaniesResponseDto })
  @Get()
  async list(@Query() query: ListCompaniesQueryDto): Promise<PaginatedCompaniesResponseDto> {
    return this.queryBus.execute(new ListCompaniesQuery(query.page, query.limit));
  }

  @ApiOperation({ summary: 'Get a company profile by id' })
  @ApiResponse({ status: 200, type: CompanyResponseDto })
  @Get(':id')
  async getById(@Param('id') id: string): Promise<CompanyResponseDto> {
    return this.queryBus.execute(new GetCompanyQuery(id));
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update the company profile (owner or admin only)' })
  @ApiResponse({ status: 200, type: CompanyResponseDto })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateCompanyDto,
  ): Promise<CompanyResponseDto> {
    return this.commandBus.execute(new UpdateCompanyCommand(id, user.sub, user.role, dto));
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Archive the company profile (owner or admin only)' })
  @ApiResponse({ status: 201, type: CompanyResponseDto })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @Post(':id/archive')
  async archive(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<CompanyResponseDto> {
    return this.commandBus.execute(new ArchiveCompanyCommand(id, user.sub, user.role));
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Restore an archived company profile (owner or admin only)' })
  @ApiResponse({ status: 201, type: CompanyResponseDto })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @Post(':id/restore')
  async restore(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<CompanyResponseDto> {
    return this.commandBus.execute(new RestoreCompanyCommand(id, user.sub, user.role));
  }
}
