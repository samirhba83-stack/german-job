import { ActorRole, TransitionReasonCode } from '@german-job-engine/shared-types';

export class RejectApplicationCommand {
  constructor(
    public readonly applicationId: string,
    public readonly actorRole: ActorRole,
    public readonly actorId: string | null,
    public readonly reasonCode: TransitionReasonCode,
    public readonly reasonNote?: string,
    public readonly correlationId?: string,
  ) {}
}
