'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import * as companiesApi from '../api/companies.api';
import type { SearchCompaniesParams } from '../api/companies.api';

/** Real `GET /companies/search` (see `companies.api.ts` for why this covers the plain list too).
 * `keepPreviousData` avoids a full-page loading flash when paging or changing a filter — the same
 * real TanStack Query pagination primitive `useCampaigns` already established
 * (docs/campaign-workspace/07-performance.md), reused here rather than reinvented. */
export function useCompanies(params: SearchCompaniesParams) {
  return useQuery({
    queryKey: ['companies', 'search', params],
    queryFn: () => companiesApi.searchCompanies(params),
    placeholderData: keepPreviousData,
  });
}
