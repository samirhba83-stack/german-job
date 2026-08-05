import { CampaignActorRole } from '@german-job-engine/shared-types';
import { ValueObject } from '../../../../shared/domain';

interface ActorProps {
  role: CampaignActorRole;
  actorId: string | null;
}

/** Own copy of the Applications module's Actor VO — the Campaign module stays self-contained. */
export class Actor extends ValueObject<ActorProps> {
  private constructor(props: ActorProps) {
    super(props);
  }

  get role(): CampaignActorRole {
    return this.props.role;
  }

  get actorId(): string | null {
    return this.props.actorId;
  }

  static candidate(actorId: string): Actor {
    return new Actor({ role: CampaignActorRole.CANDIDATE, actorId });
  }

  static admin(actorId: string): Actor {
    return new Actor({ role: CampaignActorRole.ADMIN, actorId });
  }

  static system(source: string): Actor {
    return new Actor({ role: CampaignActorRole.SYSTEM, actorId: source });
  }

  static automation(engine: string): Actor {
    return new Actor({ role: CampaignActorRole.AUTOMATION, actorId: engine });
  }

  static reconstitute(role: CampaignActorRole, actorId: string | null): Actor {
    return new Actor({ role, actorId });
  }
}
