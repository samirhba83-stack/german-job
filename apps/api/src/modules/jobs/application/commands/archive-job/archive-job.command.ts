import { UserRole } from '@german-job-engine/shared-types';

export class ArchiveJobCommand {
  constructor(
    public readonly jobId: string,
    public readonly requesterId: string,
    public readonly requesterRole: UserRole,
  ) {}
}
