import { PolicyDecision, allow, deny } from './campaign-policy.interface';
import { IsDuplicateTargetSpecification } from '../specifications/is-duplicate-target.specification';
import { CampaignTarget } from '../entities/campaign-target.entity';
import { CompanyMemoryEntry } from '../entities/company-memory-entry.entity';

/** Real, enforced spam-protection rule — refuses a target already applied/contacted. */
export class DuplicateDetectionPolicy {
  authorize(
    jobId: string,
    companyId: string,
    existingTargets: ReadonlyArray<CampaignTarget>,
    companyMemory: CompanyMemoryEntry | null,
  ): PolicyDecision {
    if (IsDuplicateTargetSpecification.isSatisfiedBy(jobId, companyId, existingTargets, companyMemory)) {
      return deny('DUPLICATE_TARGET', `A target for job ${jobId} already exists or was already applied to.`);
    }
    return allow();
  }
}
