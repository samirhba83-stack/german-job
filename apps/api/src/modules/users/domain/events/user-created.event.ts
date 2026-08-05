import { DomainEvent } from '../../../../shared/domain';

export class UserCreatedEvent extends DomainEvent {
  constructor(public readonly userId: string) {
    super();
  }
}
