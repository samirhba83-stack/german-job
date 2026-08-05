import { ForbiddenException, Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ActorRole } from '@german-job-engine/shared-types';
import { SearchApplicationsQuery } from './search-applications.query';
import {
  APPLICATION_REPOSITORY,
  ApplicationRepository,
} from '../../../domain/repositories/application.repository.interface';
import { ApplicationSearchSpecification } from '../../../domain/specifications/application-search.specification';
import { PaginatedApplicationsReadModel } from '../../read-models/application.read-model';
import { ApplicationReadModelMapper } from '../../read-models/application-read-model.mapper';
import { COMPANY_REPOSITORY, CompanyRepository } from '../../../../companies/domain/repositories/company.repository.interface';

/**
 * Ownership-scoped by requester role: a Candidate may only ever search their own applications
 * (their candidateId is enforced regardless of what was requested); an Employer must name a
 * companyId they own (there is no "all my companies" fan-out — the frontend always scopes by one
 * company); Admin and System are unrestricted.
 */
@QueryHandler(SearchApplicationsQuery)
export class SearchApplicationsHandler implements IQueryHandler<SearchApplicationsQuery> {
  constructor(
    @Inject(APPLICATION_REPOSITORY) private readonly applicationRepository: ApplicationRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companyRepository: CompanyRepository,
  ) {}

  async execute(query: SearchApplicationsQuery): Promise<PaginatedApplicationsReadModel> {
    let candidateId = query.candidateId;
    const companyId = query.companyId;

    if (query.requesterRole === ActorRole.CANDIDATE) {
      candidateId = query.requesterId ?? undefined;
    } else if (query.requesterRole === ActorRole.COMPANY) {
      if (!companyId) {
        throw new ForbiddenException('An Employer must scope this search to a companyId they own');
      }
      const company = await this.companyRepository.findById(companyId);
      if (!company || company.ownerId !== query.requesterId) {
        throw new ForbiddenException('You do not have permission to search applications for this company');
      }
    }

    const specification = ApplicationSearchSpecification.create({
      candidateId,
      jobId: query.jobId,
      companyId,
      status: query.status,
      channelType: query.channelType,
      createdFrom: query.createdFrom,
      createdTo: query.createdTo,
      page: query.page,
      limit: query.limit,
    });

    const { items, total } = await this.applicationRepository.search(specification);

    return {
      items: items.map((application) => ApplicationReadModelMapper.toReadModel(application)),
      total,
      page: specification.page,
      limit: specification.limit,
    };
  }
}
