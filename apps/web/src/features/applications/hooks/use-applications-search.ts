'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import * as applicationsApi from '../api/applications.api';
import type { SearchApplicationsParams } from '../api/applications.api';

/** Real `GET /applications/search`. Generic over any real filter combination — the Company
 * Workspace uses `{companyId}`; a future Applications screen could use `{candidateId}` or
 * `{status}` through this same hook without a parallel one being written (docs/company-workspace/
 * 01-architecture.md). */
export function useApplicationsSearch(params: SearchApplicationsParams) {
  return useQuery({
    queryKey: ['applications', 'search', params],
    queryFn: () => applicationsApi.searchApplications(params),
    placeholderData: keepPreviousData,
  });
}
