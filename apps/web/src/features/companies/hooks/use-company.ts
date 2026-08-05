'use client';

import { useQuery } from '@tanstack/react-query';
import * as companiesApi from '../api/companies.api';

/** Real `GET /companies/:id` — the Company Workspace's primary query. */
export function useCompany(id: string) {
  return useQuery({
    queryKey: ['company', id],
    queryFn: () => companiesApi.getCompany(id),
  });
}
