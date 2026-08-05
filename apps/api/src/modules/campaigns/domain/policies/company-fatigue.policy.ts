import { PolicyDecision, allow, deny } from './campaign-policy.interface';
import { IsCompanyInCooldownSpecification } from '../specifications/is-company-in-cooldown.specification';
import { CompanyMemoryEntry } from '../entities/company-memory-entry.entity';

/** Real, enforced spam-protection rule — refuses a target whose company is cooling down. */
export class CompanyFatiguePolicy {
  authorize(companyMemory: CompanyMemoryEntry | null, referenceDate: Date = new Date()): PolicyDecision {
    if (IsCompanyInCooldownSpecification.isSatisfiedBy(companyMemory, referenceDate)) {
      return deny('COMPANY_IN_COOLDOWN', `Company ${companyMemory?.companyId} is in a cooldown period.`);
    }
    return allow();
  }
}
