'use client';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useCompanyActions } from '../hooks/use-company-actions';
import { canManageCompany } from '../lib/can-manage-company';
import { CompanyStatus } from '../types';
import type { CompanyDto } from '../types';

/**
 * docs/company-workspace/. Real `POST /companies/:id/{archive,restore}` actions, gated by
 * `canManageCompany()` — real backend role (`EMPLOYER`/`ADMIN`) plus real ownership, the single
 * shared check `CompanyListRow` also uses. `GET /companies/search` returns every active company
 * platform-wide with no owner filter, so without this an employer viewing a company they don't own
 * would see an Archive button that only ever fails with a real 403 — checking ownership here isn't
 * a security boundary (the backend's own guard is that), it's an honest UI that doesn't offer an
 * action a real user can't actually take.
 */
export function CompanyActions({ company }: { company: CompanyDto }) {
  const { user } = useAuth();
  const { archive, restore } = useCompanyActions(company.id);

  if (!canManageCompany(company, user)) return null;

  if (company.status === CompanyStatus.ACTIVE) {
    return (
      <Button size="sm" variant="secondary" loading={archive.isPending} onClick={() => archive.mutate(undefined)}>
        Archive
      </Button>
    );
  }

  return (
    <Button size="sm" variant="secondary" loading={restore.isPending} onClick={() => restore.mutate(undefined)}>
      Restore
    </Button>
  );
}
