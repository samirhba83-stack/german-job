'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTrackedMutation } from '@/lib/hooks/use-tracked-mutation';
import * as inboxApi from '../api/inbox.api';
import type { ReplyPrimaryCategory } from '../types';

/** Every real correction/confirmation write `POST /inbox/messages/:id/...` supports. Every
 * mutation invalidates both the single-message detail query and the list query, since a
 * correction changes fields shown in both places (e.g. `primaryCategory` on the list row). */
export function useInboxMessageActions(messageId: string) {
  const queryClient = useQueryClient();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['inbox-message', messageId] });
    queryClient.invalidateQueries({ queryKey: ['inbox-messages'] });
  }

  const correctClassification = useTrackedMutation({
    activityLabel: 'Correcting classification',
    successMessage: 'Classification corrected',
    mutationFn: (input: { category: ReplyPrimaryCategory; reason?: string }) => inboxApi.correctClassification(messageId, input),
    onSuccess: invalidate,
  });

  const markUnrelated = useTrackedMutation({
    activityLabel: 'Marking as unrelated',
    successMessage: 'Marked as unrelated',
    mutationFn: (reason?: string) => inboxApi.markMessageUnrelated(messageId, reason),
    onSuccess: invalidate,
  });

  const confirmApplicationMatch = useTrackedMutation({
    activityLabel: 'Confirming application match',
    successMessage: 'Application match confirmed',
    mutationFn: (input: { applicationId: string; campaignId?: string }) => inboxApi.confirmApplicationMatch(messageId, input),
    onSuccess: invalidate,
  });

  return { correctClassification, markUnrelated, confirmApplicationMatch };
}
