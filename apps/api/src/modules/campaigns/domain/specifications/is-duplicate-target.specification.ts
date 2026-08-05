import { CampaignTargetStatus } from '@german-job-engine/shared-types';
import { CampaignTarget } from '../entities/campaign-target.entity';
import { CompanyMemoryEntry } from '../entities/company-memory-entry.entity';

const NON_DUPLICATE_STATUSES: ReadonlyArray<CampaignTargetStatus> = [
  CampaignTargetStatus.SKIPPED,
  CampaignTargetStatus.FAILED,
  CampaignTargetStatus.EXCLUDED,
];

/** A target already represented by an active CampaignTarget or a company memory flag. */
export class IsDuplicateTargetSpecification {
  static isSatisfiedBy(
    jobId: string,
    companyId: string,
    existingTargets: ReadonlyArray<CampaignTarget>,
    companyMemory: CompanyMemoryEntry | null,
  ): boolean {
    const hasActiveTargetForJob = existingTargets.some(
      (target) => target.jobId === jobId && !NON_DUPLICATE_STATUSES.includes(target.status),
    );
    if (hasActiveTargetForJob) {
      return true;
    }
    return companyMemory?.alreadyApplied === true || companyMemory?.alreadyContacted === true;
  }
}
