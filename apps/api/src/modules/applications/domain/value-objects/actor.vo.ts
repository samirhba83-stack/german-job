import { ActorRole } from '@german-job-engine/shared-types';
import { ValueObject } from '../../../../shared/domain';

interface ActorProps {
  role: ActorRole;
  actorId: string | null;
}

/** Who triggered a transition — a first-class concept, not a string tacked onto a log line. */
export class Actor extends ValueObject<ActorProps> {
  private constructor(props: ActorProps) {
    super(props);
  }

  get role(): ActorRole {
    return this.props.role;
  }

  get actorId(): string | null {
    return this.props.actorId;
  }

  static candidate(actorId: string): Actor {
    return new Actor({ role: ActorRole.CANDIDATE, actorId });
  }

  static company(actorId: string): Actor {
    return new Actor({ role: ActorRole.COMPANY, actorId });
  }

  static admin(actorId: string): Actor {
    return new Actor({ role: ActorRole.ADMIN, actorId });
  }

  static system(source: string): Actor {
    return new Actor({ role: ActorRole.SYSTEM, actorId: source });
  }

  static automation(engine: string): Actor {
    return new Actor({ role: ActorRole.AUTOMATION, actorId: engine });
  }

  /** Rehydrates an Actor from persistence, where role and actorId were stored as plain columns. */
  static reconstitute(role: ActorRole, actorId: string | null): Actor {
    return new Actor({ role, actorId });
  }
}
