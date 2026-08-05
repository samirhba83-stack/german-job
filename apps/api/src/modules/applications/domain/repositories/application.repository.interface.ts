import { Repository } from '../../../../shared/application';
import { Application } from '../entities/application.entity';
import { ApplicationSearchSpecification } from '../specifications/application-search.specification';

export const APPLICATION_REPOSITORY = Symbol('APPLICATION_REPOSITORY');

export interface ApplicationSearchResult {
  items: Application[];
  total: number;
}

export interface ApplicationRepository extends Repository<Application, string> {
  findByCandidateId(candidateId: string): Promise<Application[]>;
  search(specification: ApplicationSearchSpecification): Promise<ApplicationSearchResult>;
}
