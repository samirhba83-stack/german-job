import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetApplicationHistoryQuery } from './get-application-history.query';
import {
  APPLICATION_REPOSITORY,
  ApplicationRepository,
} from '../../../domain/repositories/application.repository.interface';
import { assertCanAccessApplication, loadApplicationOrThrow } from '../../application-command.helpers';
import { ApplicationHistoryEntryReadModel } from '../../read-models/application.read-model';
import { ApplicationReadModelMapper } from '../../read-models/application-read-model.mapper';
import { COMPANY_REPOSITORY, CompanyRepository } from '../../../../companies/domain/repositories/company.repository.interface';

/** Returns the narrative, human-readable history — distinct from GetTimeline's raw ledger. */
@QueryHandler(GetApplicationHistoryQuery)
export class GetApplicationHistoryHandler implements IQueryHandler<GetApplicationHistoryQuery> {
  constructor(
    @Inject(APPLICATION_REPOSITORY) private readonly applicationRepository: ApplicationRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companyRepository: CompanyRepository,
  ) {}

  async execute(query: GetApplicationHistoryQuery): Promise<ApplicationHistoryEntryReadModel[]> {
    const application = await loadApplicationOrThrow(this.applicationRepository, query.applicationId);
    await assertCanAccessApplication(this.companyRepository, application, query.requesterRole, query.requesterId);
    return application.timeline.entries().map((entry) => ApplicationReadModelMapper.toHistoryEntryReadModel(entry));
  }
}
