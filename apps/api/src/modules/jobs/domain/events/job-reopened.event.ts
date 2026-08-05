import { DomainEvent } from '../../../../shared/domain';

export class JobReopenedEvent extends DomainEvent {
  constructor(public readonly jobId: string) {
    super();
  }
}
