import { ActorRole } from '@german-job-engine/shared-types';

export class SendApplicationCommand {
  constructor(
    public readonly applicationId: string,
    public readonly actorRole: ActorRole,
    public readonly actorId: string | null,
    public readonly correlationId?: string,
  ) {}
}
