import { ActorRole, ApplicationLifecycleStatus, ApplicationChannelType } from '@german-job-engine/shared-types';

export class SearchApplicationsQuery {
  constructor(
    public readonly requesterRole: ActorRole,
    public readonly requesterId: string | null,
    public readonly candidateId?: string,
    public readonly jobId?: string,
    public readonly companyId?: string,
    public readonly status?: ApplicationLifecycleStatus,
    public readonly channelType?: ApplicationChannelType,
    public readonly createdFrom?: Date,
    public readonly createdTo?: Date,
    public readonly page?: number,
    public readonly limit?: number,
  ) {}
}
