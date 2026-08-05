import { UserRole } from '@german-job-engine/shared-types';
import { AggregateRoot } from '../../../../shared/domain';
import { Email } from '../value-objects/email.vo';
import { UserCreatedEvent } from '../events/user-created.event';

export interface UserProps {
  email: Email;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
}

export class User extends AggregateRoot<string> {
  private props: UserProps;

  private constructor(id: string, props: UserProps) {
    super(id);

    if (!props.passwordHash) {
      throw new Error('User requires a password hash');
    }

    this.props = props;
  }

  get email(): Email {
    return this.props.email;
  }

  get passwordHash(): string {
    return this.props.passwordHash;
  }

  get role(): UserRole {
    return this.props.role;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  /** Registers a brand-new user and raises the corresponding domain event. */
  static create(id: string, props: UserProps): User {
    const user = new User(id, props);
    user.addDomainEvent(new UserCreatedEvent(id));
    return user;
  }

  /** Rehydrates a User from persistence without re-raising domain events. */
  static reconstitute(id: string, props: UserProps): User {
    return new User(id, props);
  }
}
