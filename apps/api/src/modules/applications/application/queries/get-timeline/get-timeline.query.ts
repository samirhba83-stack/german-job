import { ActorRole } from '@german-job-engine/shared-types';

export class GetTimelineQuery {
  constructor(
    public readonly applicationId: string,
    public readonly requesterRole: ActorRole,
    public readonly requesterId: string | null,
  ) {}
}
