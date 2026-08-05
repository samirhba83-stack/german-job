'use client';

import { useQuery } from '@tanstack/react-query';
import * as inboxApi from '../api/inbox.api';

/** Real `GET /inbox/messages/:id` — the full detail view (corrections, transition proposals,
 * drafts) in one real request. */
export function useInboxMessage(id: string) {
  return useQuery({
    queryKey: ['inbox-message', id],
    queryFn: () => inboxApi.getInboxMessage(id),
    enabled: Boolean(id),
  });
}
