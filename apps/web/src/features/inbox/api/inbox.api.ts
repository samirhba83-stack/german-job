import { apiClient } from '@/lib/api-client';
import type {
  InboxMessageDto,
  InboxMessageDetailDto,
  ApplicationTransitionProposalDto,
  ReplyDraftDto,
  NotificationDto,
  NotificationPreferenceDto,
  StartInboxConsentResponseDto,
  CorrectClassificationRequestDto,
  CorrectFactsRequestDto,
  ConfirmApplicationMatchRequestDto,
  CreateReplyDraftRequestDto,
  EditReplyDraftRequestDto,
  ApproveAndSendDraftRequestDto,
} from '../types';

/** POST /inbox/consent/start — real inbox-reading upgrade for the already-connected sending
 * mailbox. Same redirect pattern as `connected-mailbox.api.ts`'s `startMailboxConnection`: the
 * caller navigates the browser to the returned `authorizationUrl`. */
export async function startInboxConsent(): Promise<StartInboxConsentResponseDto> {
  return apiClient<StartInboxConsentResponseDto>('/inbox/consent/start', { method: 'POST' });
}

/** DELETE /inbox/consent — stops future inbox reading; real send capability is untouched. */
export async function revokeInboxConsent(): Promise<void> {
  await apiClient<{ success: true }>('/inbox/consent', { method: 'DELETE' });
}

export interface ListInboxMessagesParams {
  reviewStatus?: string;
  correlationStatus?: string;
  limit?: number;
  offset?: number;
}

/** GET /inbox/messages — no total count is returned by the backend, so callers page with
 * "load more" (offset accumulation), never a fabricated page-X-of-Y total. */
export async function listInboxMessages(params: ListInboxMessagesParams = {}): Promise<InboxMessageDto[]> {
  const query = new URLSearchParams();
  if (params.reviewStatus) query.set('reviewStatus', params.reviewStatus);
  if (params.correlationStatus) query.set('correlationStatus', params.correlationStatus);
  query.set('limit', String(params.limit ?? 50));
  query.set('offset', String(params.offset ?? 0));
  return apiClient<InboxMessageDto[]>(`/inbox/messages?${query.toString()}`);
}

export async function getInboxMessage(id: string): Promise<InboxMessageDetailDto> {
  return apiClient<InboxMessageDetailDto>(`/inbox/messages/${id}`);
}

export async function correctClassification(id: string, body: CorrectClassificationRequestDto): Promise<InboxMessageDto> {
  return apiClient<InboxMessageDto>(`/inbox/messages/${id}/corrections/classification`, { method: 'POST', body: JSON.stringify(body) });
}

export async function correctFacts(id: string, body: CorrectFactsRequestDto): Promise<InboxMessageDto> {
  return apiClient<InboxMessageDto>(`/inbox/messages/${id}/corrections/facts`, { method: 'POST', body: JSON.stringify(body) });
}

export async function markMessageUnrelated(id: string, reason?: string): Promise<InboxMessageDto> {
  return apiClient<InboxMessageDto>(`/inbox/messages/${id}/mark-unrelated`, { method: 'POST', body: JSON.stringify({ reason }) });
}

export async function confirmApplicationMatch(id: string, body: ConfirmApplicationMatchRequestDto): Promise<InboxMessageDto> {
  return apiClient<InboxMessageDto>(`/inbox/messages/${id}/confirm-application-match`, { method: 'POST', body: JSON.stringify(body) });
}

export async function confirmTransitionProposal(id: string): Promise<ApplicationTransitionProposalDto> {
  return apiClient<ApplicationTransitionProposalDto>(`/inbox/transition-proposals/${id}/confirm`, { method: 'POST' });
}

export async function rejectTransitionProposal(id: string): Promise<ApplicationTransitionProposalDto> {
  return apiClient<ApplicationTransitionProposalDto>(`/inbox/transition-proposals/${id}/reject`, { method: 'POST' });
}

export async function createReplyDraft(messageId: string, body: CreateReplyDraftRequestDto): Promise<ReplyDraftDto> {
  return apiClient<ReplyDraftDto>(`/inbox/messages/${messageId}/drafts`, { method: 'POST', body: JSON.stringify(body) });
}

export async function editReplyDraft(draftId: string, body: EditReplyDraftRequestDto): Promise<ReplyDraftDto> {
  return apiClient<ReplyDraftDto>(`/inbox/drafts/${draftId}`, { method: 'PATCH', body: JSON.stringify(body) });
}

/** POST /inbox/drafts/:id/approve-and-send — the ONLY path a drafted reply can ever be sent from;
 * requires this explicit, separate click (M29 Non-Negotiable Principle: never auto-send). */
export async function approveAndSendDraft(draftId: string, body: ApproveAndSendDraftRequestDto): Promise<ReplyDraftDto> {
  return apiClient<ReplyDraftDto>(`/inbox/drafts/${draftId}/approve-and-send`, { method: 'POST', body: JSON.stringify(body) });
}

export async function discardReplyDraft(draftId: string): Promise<ReplyDraftDto> {
  return apiClient<ReplyDraftDto>(`/inbox/drafts/${draftId}/discard`, { method: 'POST' });
}

export async function listNotifications(limit = 50, offset = 0): Promise<NotificationDto[]> {
  return apiClient<NotificationDto[]>(`/inbox/notifications?limit=${limit}&offset=${offset}`);
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiClient<{ success: true }>(`/inbox/notifications/${id}/read`, { method: 'POST' });
}

export async function getNotificationPreferences(): Promise<NotificationPreferenceDto> {
  return apiClient<NotificationPreferenceDto>('/inbox/notification-preferences');
}

export async function updateNotificationPreferences(patch: Partial<Omit<NotificationPreferenceDto, 'userId'>>): Promise<NotificationPreferenceDto> {
  return apiClient<NotificationPreferenceDto>('/inbox/notification-preferences', { method: 'PATCH', body: JSON.stringify(patch) });
}
