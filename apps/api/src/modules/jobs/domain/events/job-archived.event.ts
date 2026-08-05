import { DomainEvent } from '../../../../shared/domain';

export class JobArchivedEvent extends DomainEvent {
  constructor(public readonly jobId: string) {
    super();
  }
}
