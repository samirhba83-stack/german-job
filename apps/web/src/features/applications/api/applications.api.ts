import { apiClient } from '@/lib/api-client';
import type { ApplicationDto, ApplicationTimelineEntryDto, PaginatedApplicationsDto } from '../types';

export interface SearchApplicationsParams {
  candidateId?: string;
  jobId?: string;
  companyId?: string;
  status?: string;
  channelType?: string;
  page?: number;
  limit?: number;
}

/**
 * GET /applications/search — real, live, filterable by `companyId` (verified during Milestone 24
 * research; the real backend contract, not assumed from docs/frontend-architecture, which had at
 * least one stale claim about a different module's filters). This is the Company Workspace's real
 * data source for History/Communication Timeline/Analytics — Applications carry a real
 * `companyId`, unlike Campaigns, which have no real link back to a company at all
 * (docs/company-workspace/03-integration-points.md).
 */
export async function searchApplications(params: SearchApplicationsParams): Promise<PaginatedApplicationsDto> {
  const query = new URLSearchParams();
  if (params.candidateId) query.set('candidateId', params.candidateId);
  if (params.jobId) query.set('jobId', params.jobId);
  if (params.companyId) query.set('companyId', params.companyId);
  if (params.status) query.set('status', params.status);
  if (params.channelType) query.set('channelType', params.channelType);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiClient<PaginatedApplicationsDto>(`/applications/search${qs ? `?${qs}` : ''}`);
}

/** GET /applications/:id. */
export async function getApplication(id: string): Promise<ApplicationDto> {
  return apiClient<ApplicationDto>(`/applications/${id}`);
}

/** GET /applications/:id/timeline — the real per-application transition ledger. Deliberately
 * fetched lazily, per application, only when a user actually expands it (Communication Timeline,
 * docs/company-workspace/07-performance.md) rather than eagerly for every application a Company
 * Workspace lists — fetching N timelines up front for N applications is a real N+1 pattern this
 * milestone's Performance Validation explicitly asks to avoid. */
export async function getApplicationTimeline(id: string): Promise<ApplicationTimelineEntryDto[]> {
  return apiClient<ApplicationTimelineEntryDto[]>(`/applications/${id}/timeline`);
}
