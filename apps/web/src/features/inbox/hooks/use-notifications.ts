'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTrackedMutation } from '@/lib/hooks/use-tracked-mutation';
import * as inboxApi from '../api/inbox.api';

export function useNotifications() {
  return useQuery({
    queryKey: ['inbox-notifications'],
    queryFn: () => inboxApi.listNotifications(),
  });
}

export function useNotificationActions() {
  const queryClient = useQueryClient();

  const markRead = useTrackedMutation({
    activityLabel: 'Marking notification read',
    mutationFn: (id: string) => inboxApi.markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inbox-notifications'] }),
  });

  return { markRead };
}
