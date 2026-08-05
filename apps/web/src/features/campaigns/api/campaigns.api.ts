import { apiClient } from '@/lib/api-client';
import type {
  CampaignDto,
  CampaignExecutionStatusDto,
  CampaignGoalDto,
  CampaignReasonCode,
  CampaignStatus,
  CampaignStrategyDto,
  CampaignStrategyType,
  CampaignTimelineEntryDto,
  ExecutionWindowDto,
  PaginatedCampaignsDto,
  RateLimitProfileDto,
  SmartBatchPlanDto,
} from '../types';

export interface ListCampaignsParams {
  page?: number;
  limit?: number;
}

/** GET /campaigns — real, live, paginated (docs/campaign-workspace/03-integration-points.md). */
export async function listCampaigns(params: ListCampaignsParams = {}): Promise<PaginatedCampaignsDto> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiClient<PaginatedCampaignsDto>(`/campaigns${qs ? `?${qs}` : ''}`);
}

export interface SearchCampaignsParams {
  status?: CampaignStatus;
  strategyType?: CampaignStrategyType;
  createdFrom?: string;
  createdTo?: string;
  page?: number;
  limit?: number;
}

/** GET /campaigns/search — real, live, server-side filtering by status/strategyType/date range;
 * ownerId is deliberately never sent from here — the backend forces it to the authenticated
 * candidate for any non-admin caller (Milestone 24.5), so a client-supplied value would be
 * pointless at best. There is no real `name`/keyword filter on this endpoint — see
 * `useCampaignsSearch` for how name search is handled client-side instead. */
export async function searchCampaigns(params: SearchCampaignsParams = {}): Promise<PaginatedCampaignsDto> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.strategyType) query.set('strategyType', params.strategyType);
  if (params.createdFrom) query.set('createdFrom', params.createdFrom);
  if (params.createdTo) query.set('createdTo', params.createdTo);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiClient<PaginatedCampaignsDto>(`/campaigns/search${qs ? `?${qs}` : ''}`);
}

export interface CampaignPayload {
  name: string;
  goal: CampaignGoalDto;
  strategy: CampaignStrategyDto;
  batchPlan: SmartBatchPlanDto;
  executionWindow: ExecutionWindowDto;
  rateLimitProfile?: RateLimitProfileDto;
}

export type UpdateCampaignPayload = Partial<CampaignPayload>;

/** POST /campaigns — real, live. `ownerId` is never part of the body; the backend derives it from
 * the authenticated candidate (mirrors job/company creation). */
export async function createCampaign(payload: CampaignPayload): Promise<CampaignDto> {
  return apiClient<CampaignDto>('/campaigns', { method: 'POST', body: JSON.stringify(payload) });
}

/** PATCH /campaigns/:id — real, live; only reachable while the campaign is DRAFT or READY
 * (`EDITABLE_STATES` in `campaign.entity.ts`) — the backend is the authority, this isn't
 * replicated client-side beyond hiding the Edit action for a non-editable status. */
export async function updateCampaign(id: string, payload: UpdateCampaignPayload): Promise<CampaignDto> {
  return apiClient<CampaignDto>(`/campaigns/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

/** GET /campaigns/:id. */
export async function getCampaign(id: string): Promise<CampaignDto> {
  return apiClient<CampaignDto>(`/campaigns/${id}`);
}

/** GET /campaigns/:id/timeline — the real transition ledger backing both the Lifecycle stage
 * tracker and the Progress event log. */
export async function getCampaignTimeline(id: string): Promise<CampaignTimelineEntryDto[]> {
  return apiClient<CampaignTimelineEntryDto[]>(`/campaigns/${id}/timeline`);
}

/** GET /campaigns/:id/execution-status — real target-status-breakdown and goal-progress
 * aggregates; the only real per-target signal the backend exposes today. */
export async function getCampaignExecutionStatus(id: string): Promise<CampaignExecutionStatusDto> {
  return apiClient<CampaignExecutionStatusDto>(`/campaigns/${id}/execution-status`);
}

export interface CampaignReasonPayload {
  reasonCode?: CampaignReasonCode;
  reasonNote?: string;
}

export interface RequiredCampaignReasonPayload {
  reasonCode: CampaignReasonCode;
  reasonNote?: string;
}

/** POST /campaigns/:id/start. */
export async function startCampaign(id: string): Promise<CampaignDto> {
  return apiClient<CampaignDto>(`/campaigns/${id}/start`, { method: 'POST' });
}

/** POST /campaigns/:id/pause — reason is optional per the real backend contract. */
export async function pauseCampaign(id: string, payload: CampaignReasonPayload = {}): Promise<CampaignDto> {
  return apiClient<CampaignDto>(`/campaigns/${id}/pause`, { method: 'POST', body: JSON.stringify(payload) });
}

/** POST /campaigns/:id/resume — reason is optional per the real backend contract. */
export async function resumeCampaign(id: string, payload: CampaignReasonPayload = {}): Promise<CampaignDto> {
  return apiClient<CampaignDto>(`/campaigns/${id}/resume`, { method: 'POST', body: JSON.stringify(payload) });
}

/** POST /campaigns/:id/cancel — the only transition whose reason the backend requires. */
export async function cancelCampaign(id: string, payload: RequiredCampaignReasonPayload): Promise<CampaignDto> {
  return apiClient<CampaignDto>(`/campaigns/${id}/cancel`, { method: 'POST', body: JSON.stringify(payload) });
}

/** POST /campaigns/:id/complete. */
export async function completeCampaign(id: string): Promise<CampaignDto> {
  return apiClient<CampaignDto>(`/campaigns/${id}/complete`, { method: 'POST' });
}

/** POST /campaigns/:id/archive — reason is optional per the real backend contract. */
export async function archiveCampaign(id: string, payload: CampaignReasonPayload = {}): Promise<CampaignDto> {
  return apiClient<CampaignDto>(`/campaigns/${id}/archive`, { method: 'POST', body: JSON.stringify(payload) });
}
