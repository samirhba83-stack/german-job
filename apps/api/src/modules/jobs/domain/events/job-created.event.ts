import { DomainEvent } from '../../../../shared/domain';

export class JobCreatedEvent extends DomainEvent {
  constructor(
    public readonly jobId: string,
    public readonly companyId: string,
  ) {
    super();
  }
}
