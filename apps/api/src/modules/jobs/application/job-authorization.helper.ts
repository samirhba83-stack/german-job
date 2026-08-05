import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@german-job-engine/shared-types';
import { CompanyRepository } from '../../companies/domain/repositories/company.repository.interface';

/** Shared ownership guard for Job mutation handlers — admins bypass the company-ownership check. */
export async function assertCanManageJob(
  companyRepository: CompanyRepository,
  companyId: string,
  requesterId: string,
  requesterRole: UserRole,
): Promise<void> {
  if (requesterRole === UserRole.ADMIN) return;

  const company = await companyRepository.findById(companyId);
  if (!company || company.ownerId !== requesterId) {
    throw new ForbiddenException('You do not have permission to manage this job');
  }
}
