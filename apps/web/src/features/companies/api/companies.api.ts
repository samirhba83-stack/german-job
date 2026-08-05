import { apiClient } from '@/lib/api-client';
import type { CompanyDto, CompanyIndustry, CompanySize, VisaSponsorship, PaginatedCompaniesDto } from '../types';

export interface SearchCompaniesParams {
  keyword?: string;
  industry?: CompanyIndustry;
  size?: CompanySize;
  city?: string;
  visaSponsorship?: VisaSponsorship;
  page?: number;
  limit?: number;
}

/**
 * GET /companies/search — real, live, public (no auth required). Used for both the plain list and
 * the filtered/searched list: the real backend has a separate parameterless `GET /companies`, but
 * `ListCompaniesHandler` is documented in its own source as "search with nothing" — calling
 * `/search` with no params produces the identical result, so this one function covers both instead
 * of two API functions doing the same thing (docs/company-workspace/03-integration-points.md).
 * Real, hardcoded backend behavior worth knowing: this only ever returns `ACTIVE` companies — the
 * backend applies that filter server-side unconditionally, with no way to ask for archived ones
 * except by a specific real id (`getCompany`).
 */
export async function searchCompanies(params: SearchCompaniesParams = {}): Promise<PaginatedCompaniesDto> {
  const query = new URLSearchParams();
  if (params.keyword) query.set('keyword', params.keyword);
  if (params.industry) query.set('industry', params.industry);
  if (params.size) query.set('size', params.size);
  if (params.city) query.set('city', params.city);
  if (params.visaSponsorship) query.set('visaSponsorship', params.visaSponsorship);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiClient<PaginatedCompaniesDto>(`/companies/search${qs ? `?${qs}` : ''}`);
}

/** GET /companies/:id — real, live, public. Returns a company regardless of status (active or
 * archived) or ownership — the backend applies no gating here at all. */
export async function getCompany(id: string): Promise<CompanyDto> {
  return apiClient<CompanyDto>(`/companies/${id}`);
}

/** POST /companies/:id/archive — real, live; EMPLOYER/ADMIN only (enforced server-side). */
export async function archiveCompany(id: string): Promise<CompanyDto> {
  return apiClient<CompanyDto>(`/companies/${id}/archive`, { method: 'POST' });
}

/** POST /companies/:id/restore — real, live; EMPLOYER/ADMIN only (enforced server-side). */
export async function restoreCompany(id: string): Promise<CompanyDto> {
  return apiClient<CompanyDto>(`/companies/${id}/restore`, { method: 'POST' });
}
