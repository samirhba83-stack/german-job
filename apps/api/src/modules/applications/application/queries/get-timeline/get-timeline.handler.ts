import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetTimelineQuery } from './get-timeline.query';
import {
  APPLICATION_REPOSITORY,
  ApplicationRepository,
} from '../../../domain/repositories/application.repository.interface';
import { assertCanAccessApplication, loadApplicationOrThrow } from '../../application-command.helpers';
import { TimelineEntryReadModel } from '../../read-models/application.read-model';
import { ApplicationReadModelMapper } from '../../read-models/application-read-model.mapper';
import { COMPANY_REPOSITORY, CompanyRepository } from '../../../../companies/domain/repositories/company.repository.interface';

/** Returns the raw, complete Timeline ledger — the full explainability record, entry by entry. */
@QueryHandler(GetTimelineQuery)
export class GetTimelineHandler implements IQueryHandler<GetTimelineQuery> {
  constructor(
    @Inject(APPLICATION_REPOSITORY) private readonly applicationRepository: ApplicationRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companyRepository: CompanyRepository,
  ) {}

  async execute(query: GetTimelineQuery): Promise<TimelineEntryReadModel[]> {
    const application = await loadApplicationOrThrow(this.applicationRepository, query.applicationId);
    await assertCanAccessApplication(this.companyRepository, application, query.requesterRole, query.requesterId);
    return application.timeline.entries().map((entry) => ApplicationReadModelMapper.toTimelineEntryReadModel(entry));
  }
}
