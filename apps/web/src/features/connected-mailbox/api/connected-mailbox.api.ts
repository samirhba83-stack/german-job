import { apiClient } from '@/lib/api-client';
import type { ConnectedMailboxDto, StartMailboxConnectionResponseDto } from '../types';

export type MailboxProviderSlug = 'google' | 'microsoft';

/** GET /mailbox-connections/me — the current user's connected mailbox(es); today at most one,
 * matching the backend's "one active connected sending mailbox" model (M28.6 Phase 7). */
export async function getMyMailboxes(): Promise<ConnectedMailboxDto[]> {
  return apiClient<ConnectedMailboxDto[]>('/mailbox-connections/me');
}

/** POST /mailbox-connections/:provider/start — the caller navigates the browser to the returned
 * `authorizationUrl` (the real Google/Microsoft consent screen), same pattern as billing
 * checkout's `checkoutUrl`. */
export async function startMailboxConnection(provider: MailboxProviderSlug): Promise<StartMailboxConnectionResponseDto> {
  return apiClient<StartMailboxConnectionResponseDto>(`/mailbox-connections/${provider}/start`, { method: 'POST' });
}

/** DELETE /mailbox-connections/:id — real local token destruction plus best-effort provider
 * revocation. */
export async function disconnectMailbox(id: string): Promise<void> {
  await apiClient<{ success: true }>(`/mailbox-connections/${id}`, { method: 'DELETE' });
}
