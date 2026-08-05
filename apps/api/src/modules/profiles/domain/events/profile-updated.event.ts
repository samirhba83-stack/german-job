import { DomainEvent } from '../../../../shared/domain';

export class ProfileUpdatedEvent extends DomainEvent {
  constructor(public readonly profileId: string) {
    super();
  }
}
