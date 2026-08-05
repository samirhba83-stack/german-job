'use client';

import { useQuery } from '@tanstack/react-query';
import * as inboxApi from '../api/inbox.api';
import type { ListInboxMessagesParams } from '../api/inbox.api';

/** Real `GET /inbox/messages`. No total count comes back from the backend — `useInboxMessageList`
 * (the component using this hook) accumulates pages itself rather than assuming a fabricated
 * total, matching `CompanyList`'s "never invent a signal the backend doesn't provide" discipline. */
export function useInboxMessages(params: ListInboxMessagesParams) {
  return useQuery({
    queryKey: ['inbox-messages', params],
    queryFn: () => inboxApi.listInboxMessages(params),
  });
}
