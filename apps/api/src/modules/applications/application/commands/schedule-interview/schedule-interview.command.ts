import { ActorRole } from '@german-job-engine/shared-types';

export class ScheduleInterviewCommand {
  constructor(
    public readonly applicationId: string,
    public readonly actorRole: ActorRole,
    public readonly actorId: string | null,
    public readonly metadata: Record<string, string | number | boolean>,
    public readonly correlationId?: string,
  ) {}
}
