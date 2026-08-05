import { UserRole } from '@german-job-engine/shared-types';

export class GetUserQuery {
  constructor(
    public readonly userId: string,
    public readonly requesterRole: UserRole,
    public readonly requesterId: string,
  ) {}
}
