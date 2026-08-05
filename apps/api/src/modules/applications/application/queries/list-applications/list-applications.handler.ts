import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ListApplicationsQuery } from './list-applications.query';
import {
  APPLICATION_REPOSITORY,
  ApplicationRepository,
} from '../../../domain/repositories/application.repository.interface';
import { ApplicationSearchSpecification } from '../../../domain/specifications/application-search.specification';
import { PaginatedApplicationsReadModel } from '../../read-models/application.read-model';
import { ApplicationReadModelMapper } from '../../read-models/application-read-model.mapper';

/** Listing is search with no filters applied — reuses the same repository primitive. */
@QueryHandler(ListApplicationsQuery)
export class ListApplicationsHandler implements IQueryHandler<ListApplicationsQuery> {
  constructor(@Inject(APPLICATION_REPOSITORY) private readonly applicationRepository: ApplicationRepository) {}

  async execute(query: ListApplicationsQuery): Promise<PaginatedApplicationsReadModel> {
    const specification = ApplicationSearchSpecification.create({ page: query.page, limit: query.limit });

    const { items, total } = await this.applicationRepository.search(specification);

    return {
      items: items.map((application) => ApplicationReadModelMapper.toReadModel(application)),
      total,
      page: specification.page,
      limit: specification.limit,
    };
  }
}
