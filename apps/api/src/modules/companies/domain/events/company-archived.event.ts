import { DomainEvent } from '../../../../shared/domain';

export class CompanyArchivedEvent extends DomainEvent {
  constructor(public readonly companyId: string) {
    super();
  }
}
