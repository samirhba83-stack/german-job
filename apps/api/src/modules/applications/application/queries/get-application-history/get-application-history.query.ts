import { ActorRole } from '@german-job-engine/shared-types';

export class GetApplicationHistoryQuery {
  constructor(
    public readonly applicationId: string,
    public readonly requesterRole: ActorRole,
    public readonly requesterId: string | null,
  ) {}
}
