import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CompaniesModule } from '../companies/companies.module';
import { ApplicationsController } from './presentation/controllers/applications.controller';
import { CreateApplicationHandler } from './application/commands/create-application/create-application.handler';
import { PrepareApplicationHandler } from './application/commands/prepare-application/prepare-application.handler';
import { QueueApplicationHandler } from './application/commands/queue-application/queue-application.handler';
import { SendApplicationHandler } from './application/commands/send-application/send-application.handler';
import { MarkDeliveredHandler } from './application/commands/mark-delivered/mark-delivered.handler';
import { MarkOpenedHandler } from './application/commands/mark-opened/mark-opened.handler';
import { MarkViewedHandler } from './application/commands/mark-viewed/mark-viewed.handler';
import { RegisterCompanyReplyHandler } from './application/commands/register-company-reply/register-company-reply.handler';
import { ScheduleInterviewHandler } from './application/commands/schedule-interview/schedule-interview.handler';
import { CompleteInterviewHandler } from './application/commands/complete-interview/complete-interview.handler';
import { ReceiveOfferHandler } from './application/commands/receive-offer/receive-offer.handler';
import { SignContractHandler } from './application/commands/sign-contract/sign-contract.handler';
import { RejectApplicationHandler } from './application/commands/reject-application/reject-application.handler';
import { WithdrawApplicationHandler } from './application/commands/withdraw-application/withdraw-application.handler';
import { ArchiveApplicationHandler } from './application/commands/archive-application/archive-application.handler';
import { GetApplicationHandler } from './application/queries/get-application/get-application.handler';
import { SearchApplicationsHandler } from './application/queries/search-applications/search-applications.handler';
import { ListApplicationsHandler } from './application/queries/list-applications/list-applications.handler';
import { GetTimelineHandler } from './application/queries/get-timeline/get-timeline.handler';
import { GetApplicationHistoryHandler } from './application/queries/get-application-history/get-application-history.handler';
import { APPLICATION_REPOSITORY } from './domain/repositories/application.repository.interface';
import { PrismaApplicationRepository } from './infrastructure/persistence/prisma-application.repository';

const commandHandlers = [
  CreateApplicationHandler,
  PrepareApplicationHandler,
  QueueApplicationHandler,
  SendApplicationHandler,
  MarkDeliveredHandler,
  MarkOpenedHandler,
  MarkViewedHandler,
  RegisterCompanyReplyHandler,
  ScheduleInterviewHandler,
  CompleteInterviewHandler,
  ReceiveOfferHandler,
  SignContractHandler,
  RejectApplicationHandler,
  WithdrawApplicationHandler,
  ArchiveApplicationHandler,
];

const queryHandlers = [
  GetApplicationHandler,
  SearchApplicationsHandler,
  ListApplicationsHandler,
  GetTimelineHandler,
  GetApplicationHistoryHandler,
];

@Module({
  imports: [CqrsModule, CompaniesModule],
  controllers: [ApplicationsController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    { provide: APPLICATION_REPOSITORY, useClass: PrismaApplicationRepository },
  ],
  exports: [APPLICATION_REPOSITORY],
})
export class ApplicationsModule {}
