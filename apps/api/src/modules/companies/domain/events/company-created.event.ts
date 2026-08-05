import { DomainEvent } from '../../../../shared/domain';

export class CompanyCreatedEvent extends DomainEvent {
  constructor(
    public readonly companyId: string,
    public readonly ownerId: string,
  ) {
    super();
  }
}
