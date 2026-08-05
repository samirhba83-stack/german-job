'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTrackedMutation } from '@/lib/hooks/use-tracked-mutation';
import * as companiesApi from '../api/companies.api';

/**
 * The two real lifecycle transitions `POST /companies/:id/{archive,restore}` support, wired
 * through `useTrackedMutation` — the same hook every real mutation in this codebase uses, so both
 * actions get a real Background Activity Center entry and toast
 * (docs/interaction-framework/04-interaction-feedback-system.md). No `create`/`update` mutation is
 * exposed here: this milestone is the Company *Workspace* (an existing company's operational
 * view), not a company creation/edit form — `/companies/new` remains the honest placeholder it's
 * been since Milestone 22.3, out of this milestone's scope, same as `/campaigns/new` in M23.
 *
 * `successMessage` (Milestone 24 live-validation fix): live browser testing found neither action
 * actually produced a success toast — `useTrackedMutation` only fires one when a caller passes
 * `successMessage`, and this hook never did, despite its own doc comment (and
 * `useCampaignActions`' identical one) claiming a toast came "for free." A user archiving a
 * company previously had no immediate acknowledgment beyond the page re-rendering — the
 * Background Activity Center entry was real, but seeing it requires opening its dropdown, not the
 * "every completed action is acknowledged" standard the rest of this codebase holds itself to
 * (docs/interaction-framework/02-interaction-principles.md). The identical gap was found and
 * fixed in `useCampaignActions` at the same time, not just here.
 */
export function useCompanyActions(companyId: string) {
  const queryClient = useQueryClient();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['company', companyId] });
    queryClient.invalidateQueries({ queryKey: ['companies'] });
  }

  const archive = useTrackedMutation({
    activityLabel: 'Archiving company',
    successMessage: 'Company archived',
    mutationFn: () => companiesApi.archiveCompany(companyId),
    onSuccess: invalidate,
  });

  const restore = useTrackedMutation({
    activityLabel: 'Restoring company',
    successMessage: 'Company restored',
    mutationFn: () => companiesApi.restoreCompany(companyId),
    onSuccess: invalidate,
  });

  return { archive, restore };
}
