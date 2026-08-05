import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetApplicationQuery } from './get-application.query';
import {
  APPLICATION_REPOSITORY,
  ApplicationRepository,
} from '../../../domain/repositories/application.repository.interface';
import { assertCanAccessApplication, loadApplicationOrThrow } from '../../application-command.helpers';
import { ApplicationReadModel } from '../../read-models/application.read-model';
import { ApplicationReadModelMapper } from '../../read-models/application-read-model.mapper';
import { COMPANY_REPOSITORY, CompanyRepository } from '../../../../companies/domain/repositories/company.repository.interface';

@QueryHandler(GetApplicationQuery)
export class GetApplicationHandler implements IQueryHandler<GetApplicationQuery> {
  constructor(
    @Inject(APPLICATION_REPOSITORY) private readonly applicationRepository: ApplicationRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companyRepository: CompanyRepository,
  ) {}

  async execute(query: GetApplicationQuery): Promise<ApplicationReadModel> {
    const application = await loadApplicationOrThrow(this.applicationRepository, query.applicationId);
    await assertCanAccessApplication(this.companyRepository, application, query.requesterRole, query.requesterId);
    return ApplicationReadModelMapper.toReadModel(application);
  }
}
