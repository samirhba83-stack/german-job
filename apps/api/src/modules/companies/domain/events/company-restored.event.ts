import { DomainEvent } from '../../../../shared/domain';

export class CompanyRestoredEvent extends DomainEvent {
  constructor(public readonly companyId: string) {
    super();
  }
}
