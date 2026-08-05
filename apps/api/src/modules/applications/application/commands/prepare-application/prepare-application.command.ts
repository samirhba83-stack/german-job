import { ActorRole, TransitionReasonCode } from '@german-job-engine/shared-types';

export class PrepareApplicationCommand {
  constructor(
    public readonly applicationId: string,
    public readonly actorRole: ActorRole,
    public readonly actorId: string | null,
    public readonly correlationId?: string,
    public readonly reasonCode?: TransitionReasonCode,
    public readonly reasonNote?: string,
  ) {}
}
