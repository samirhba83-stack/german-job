import { apiClient } from '@/lib/api-client';
import type { FollowUpControlDto, RecruitmentTaskDto, FollowUpControlStatus, RecruitmentTaskStatus } from '../types';

export interface ListFollowUpControlsParams {
  status?: FollowUpControlStatus;
  limit?: number;
  offset?: number;
}

/** GET /recruitment/follow-up-controls — the current user's own follow-up holds/suppressions. */
export async function listFollowUpControls(params: ListFollowUpControlsParams = {}): Promise<FollowUpControlDto[]> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  query.set('limit', String(params.limit ?? 50));
  query.set('offset', String(params.offset ?? 0));
  return apiClient<FollowUpControlDto[]>(`/recruitment/follow-up-controls?${query.toString()}`);
}

export async function getFollowUpControl(id: string): Promise<FollowUpControlDto> {
  return apiClient<FollowUpControlDto>(`/recruitment/follow-up-controls/${id}`);
}

/** POST /recruitment/follow-up-controls/:id/release — real, reason-required release; the backend
 * refuses this for DELIVERABILITY_BLOCK controls (never candidate-releasable). */
export async function releaseFollowUpControl(id: string, reason: string): Promise<FollowUpControlDto> {
  return apiClient<FollowUpControlDto>(`/recruitment/follow-up-controls/${id}/release`, { method: 'POST', body: JSON.stringify({ reason }) });
}

export interface ListTasksParams {
  status?: RecruitmentTaskStatus;
  applicationId?: string;
  limit?: number;
  offset?: number;
}

export async function listTasks(params: ListTasksParams = {}): Promise<RecruitmentTaskDto[]> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.applicationId) query.set('applicationId', params.applicationId);
  query.set('limit', String(params.limit ?? 50));
  query.set('offset', String(params.offset ?? 0));
  return apiClient<RecruitmentTaskDto[]>(`/recruitment/tasks?${query.toString()}`);
}

export async function completeTask(id: string): Promise<RecruitmentTaskDto> {
  return apiClient<RecruitmentTaskDto>(`/recruitment/tasks/${id}/complete`, { method: 'POST' });
}

export async function dismissTask(id: string, reason?: string): Promise<RecruitmentTaskDto> {
  return apiClient<RecruitmentTaskDto>(`/recruitment/tasks/${id}/dismiss`, { method: 'POST', body: JSON.stringify({ reason }) });
}

export async function confirmTaskDueDate(id: string, dueAt: string): Promise<RecruitmentTaskDto> {
  return apiClient<RecruitmentTaskDto>(`/recruitment/tasks/${id}/confirm-due-date`, { method: 'PATCH', body: JSON.stringify({ dueAt }) });
}
