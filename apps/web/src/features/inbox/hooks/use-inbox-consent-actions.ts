'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTrackedMutation } from '@/lib/hooks/use-tracked-mutation';
import * as inboxApi from '../api/inbox.api';

/**
 * The separate inbox-reading consent upgrade — deliberately distinct from
 * `useMailboxActions().startConnection`/`disconnect` (send capability), matching the backend's own
 * "sending and inbox-reading permissions are separate" non-negotiable. `startConsent` has no
 * `successMessage`, same reason as `startConnection`: it navigates the browser away to the
 * provider's consent screen, so there's nothing left on this page to acknowledge.
 */
export function useInboxConsentActions() {
  const queryClient = useQueryClient();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['connected-mailboxes'] });
  }

  const startConsent = useTrackedMutation({
    activityLabel: 'Starting inbox access request',
    mutationFn: () => inboxApi.startInboxConsent(),
  });

  const revokeConsent = useTrackedMutation({
    activityLabel: 'Turning off inbox reading',
    successMessage: 'Inbox reading turned off — sending still works normally',
    mutationFn: () => inboxApi.revokeInboxConsent(),
    onSuccess: invalidate,
  });

  return { startConsent, revokeConsent };
}
