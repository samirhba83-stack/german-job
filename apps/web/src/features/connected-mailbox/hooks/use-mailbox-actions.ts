'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTrackedMutation } from '@/lib/hooks/use-tracked-mutation';
import * as connectedMailboxApi from '../api/connected-mailbox.api';
import type { MailboxProviderSlug } from '../api/connected-mailbox.api';

/**
 * Every real connected-mailbox write the Settings page exposes. `startConnection` deliberately has
 * no `successMessage`/query invalidation: it navigates the browser away to the provider's own
 * consent screen on success (`ConnectedMailboxCard`'s `onSuccess`), so there's nothing left on
 * this page to acknowledge — same shape as `useBillingActions`'s `checkout`.
 */
export function useMailboxActions() {
  const queryClient = useQueryClient();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['connected-mailboxes'] });
  }

  const startConnection = useTrackedMutation({
    activityLabel: 'Starting mailbox connection',
    mutationFn: (provider: MailboxProviderSlug) => connectedMailboxApi.startMailboxConnection(provider),
  });

  const disconnect = useTrackedMutation({
    activityLabel: 'Disconnecting mailbox',
    successMessage: 'Mailbox disconnected',
    mutationFn: (id: string) => connectedMailboxApi.disconnectMailbox(id),
    onSuccess: invalidate,
  });

  return { startConnection, disconnect };
}
