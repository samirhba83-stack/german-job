import { DomainEvent } from '../../../../shared/domain';

export class ProfileCreatedEvent extends DomainEvent {
  constructor(
    public readonly profileId: string,
    public readonly userId: string,
  ) {
    super();
  }
}
