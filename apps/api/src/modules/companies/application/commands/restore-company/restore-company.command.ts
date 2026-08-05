import { UserRole } from '@german-job-engine/shared-types';

export class RestoreCompanyCommand {
  constructor(
    public readonly companyId: string,
    public readonly requesterId: string,
    public readonly requesterRole: UserRole,
  ) {}
}
