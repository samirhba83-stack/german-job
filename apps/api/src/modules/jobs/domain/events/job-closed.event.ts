import { DomainEvent } from '../../../../shared/domain';

export class JobClosedEvent extends DomainEvent {
  constructor(public readonly jobId: string) {
    super();
  }
}
