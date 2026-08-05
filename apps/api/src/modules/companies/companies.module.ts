import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CompaniesController } from './presentation/controllers/companies.controller';
import { CreateCompanyHandler } from './application/commands/create-company/create-company.handler';
import { UpdateCompanyHandler } from './application/commands/update-company/update-company.handler';
import { ArchiveCompanyHandler } from './application/commands/archive-company/archive-company.handler';
import { RestoreCompanyHandler } from './application/commands/restore-company/restore-company.handler';
import { GetCompanyHandler } from './application/queries/get-company/get-company.handler';
import { SearchCompaniesHandler } from './application/queries/search-companies/search-companies.handler';
import { ListCompaniesHandler } from './application/queries/list-companies/list-companies.handler';
import { COMPANY_REPOSITORY } from './domain/repositories/company.repository.interface';
import { PrismaCompanyRepository } from './infrastructure/persistence/prisma-company.repository';

const commandHandlers = [
  CreateCompanyHandler,
  UpdateCompanyHandler,
  ArchiveCompanyHandler,
  RestoreCompanyHandler,
];
const queryHandlers = [GetCompanyHandler, SearchCompaniesHandler, ListCompaniesHandler];

@Module({
  imports: [CqrsModule],
  controllers: [CompaniesController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    { provide: COMPANY_REPOSITORY, useClass: PrismaCompanyRepository },
  ],
  exports: [COMPANY_REPOSITORY],
})
export class CompaniesModule {}
