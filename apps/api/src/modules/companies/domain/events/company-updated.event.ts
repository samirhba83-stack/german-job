import { DomainEvent } from '../../../../shared/domain';

export class CompanyUpdatedEvent extends DomainEvent {
  constructor(public readonly companyId: string) {
    super();
  }
}
