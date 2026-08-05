import { UserRole } from '@german-job-engine/shared-types';
import type { CompanyDto } from '../types';

interface UserLike {
  id: string;
  role: UserRole;
}

/**
 * Single source of truth for "can this authenticated user archive/restore this company" —
 * previously implemented slightly differently in `CompanyListRow` and `CompanyActions`
 * (Milestone 24's own "no duplicated business logic" audit caught this before it could cause the
 * two to silently disagree). Mirrors the real backend rule (`@Roles(UserRole.EMPLOYER,
 * UserRole.ADMIN)` on `CompaniesController`, plus real ownership via `company.ownerId`) — a UI
 * convenience, not a security boundary; the backend's own guard remains authoritative.
 */
export function canManageCompany(company: CompanyDto, user: UserLike | null | undefined): boolean {
  if (!user) return false;
  if (user.role === UserRole.ADMIN) return true;
  return user.role === UserRole.EMPLOYER && company.ownerId === user.id;
}
