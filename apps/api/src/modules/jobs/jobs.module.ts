import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { JobsController } from './presentation/controllers/jobs.controller';
import { CreateJobHandler } from './application/commands/create-job/create-job.handler';
import { UpdateJobHandler } from './application/commands/update-job/update-job.handler';
import { PublishJobHandler } from './application/commands/publish-job/publish-job.handler';
import { ArchiveJobHandler } from './application/commands/archive-job/archive-job.handler';
import { CloseJobHandler } from './application/commands/close-job/close-job.handler';
import { ReopenJobHandler } from './application/commands/reopen-job/reopen-job.handler';
import { GetJobHandler } from './application/queries/get-job/get-job.handler';
import { ListJobsHandler } from './application/queries/list-jobs/list-jobs.handler';
import { SearchJobsHandler } from './application/queries/search-jobs/search-jobs.handler';
import { JOB_REPOSITORY } from './domain/repositories/job.repository.interface';
import { PrismaJobRepository } from './infrastructure/persistence/prisma-job.repository';
import { CompaniesModule } from '../companies/companies.module';

const commandHandlers = [
  CreateJobHandler,
  UpdateJobHandler,
  PublishJobHandler,
  ArchiveJobHandler,
  CloseJobHandler,
  ReopenJobHandler,
];
const queryHandlers = [GetJobHandler, ListJobsHandler, SearchJobsHandler];

@Module({
  imports: [CqrsModule, CompaniesModule],
  controllers: [JobsController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    { provide: JOB_REPOSITORY, useClass: PrismaJobRepository },
  ],
  exports: [JOB_REPOSITORY],
})
export class JobsModule {}
