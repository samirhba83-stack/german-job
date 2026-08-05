'use client';

import { useQuery } from '@tanstack/react-query';
import * as connectedMailboxApi from '../api/connected-mailbox.api';

/**
 * Real `GET /mailbox-connections/me`.
 *
 * `pollUntilSettled`: after the OAuth callback redirects the user back to
 * `/settings?mailboxConnection=success`, the connection is already committed server-side by the
 * time the redirect lands (unlike Paddle's async webhook) — but polling briefly anyway guards
 * against the callback's own response landing before this page's next query tick, matching
 * `useBillingStatus`'s `pollUntilSettled` precedent rather than assuming perfect request ordering.
 */
export function useConnectedMailboxes(options: { pollUntilSettled?: boolean } = {}) {
  return useQuery({
    queryKey: ['connected-mailboxes'],
    queryFn: connectedMailboxApi.getMyMailboxes,
    refetchInterval: options.pollUntilSettled ? (query) => (query.state.data?.length ? false : 2000) : undefined,
  });
}
