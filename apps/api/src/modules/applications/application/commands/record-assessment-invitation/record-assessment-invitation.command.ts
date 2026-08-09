import { ActorRole } from '@german-job-engine/shared-types';

export class RecordAssessmentInvitationCommand {
  constructor(
    public readonly applicationId: string,
    public readonly actorRole: ActorRole,
    public readonly actorId: string | null,
    public readonly reason: string | null,
    public readonly evidence: Readonly<Record<string, unknown>> | null,
    public readonly idempotencyKey: string,
    public readonly correlationId?: string,
  ) {}
}
