import { DomainEvent } from '../../../../shared/domain';

export class JobPublishedEvent extends DomainEvent {
  constructor(public readonly jobId: string) {
    super();
  }
}
