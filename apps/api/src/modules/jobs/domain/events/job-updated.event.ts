import { DomainEvent } from '../../../../shared/domain';

export class JobUpdatedEvent extends DomainEvent {
  constructor(public readonly jobId: string) {
    super();
  }
}
