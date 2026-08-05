import { CompanyMemoryEntry } from '../entities/company-memory-entry.entity';

export class IsCompanyInCooldownSpecification {
  static isSatisfiedBy(companyMemory: CompanyMemoryEntry | null, referenceDate: Date = new Date()): boolean {
    if (!companyMemory) {
      return false;
    }
    return companyMemory.isInCooldown(referenceDate);
  }
}
