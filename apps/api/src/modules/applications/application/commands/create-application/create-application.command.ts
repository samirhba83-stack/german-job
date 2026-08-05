import { ActorRole, ApplicationChannelType } from '@german-job-engine/shared-types';

/**
 * Carries the Job/Company context the caller already has in view (e.g. rendering an "Apply now"
 * button on a job listing already has title/company/location/salary on screen) — the Applications
 * module does not reach into the Jobs or Companies repositories itself, keeping it self-contained.
 */
export class CreateApplicationCommand {
  constructor(
    public readonly candidateId: string,
    public readonly jobId: string,
    public readonly companyId: string,
    public readonly snapshot: {
      jobTitle: string;
      companyName: string;
      jobLocation: string;
      salaryRangeSummary?: string;
    },
    public readonly actorRole: ActorRole,
    public readonly actorId: string | null,
    public readonly channelType?: ApplicationChannelType,
    public readonly campaignRef?: string,
    public readonly correlationId?: string,
  ) {}
}
