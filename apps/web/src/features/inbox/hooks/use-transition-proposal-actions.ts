'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTrackedMutation } from '@/lib/hooks/use-tracked-mutation';
import * as inboxApi from '../api/inbox.api';

/** `POST /inbox/transition-proposals/:id/{confirm,reject}` — the one real click that turns a
 * proposed application-status change into an actual transition (or explicitly discards it). Never
 * happens automatically for anything but the narrow, backend-enforced delivery-failure case. */
export function useTransitionProposalActions(messageId: string) {
  const queryClient = useQueryClient();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['inbox-message', messageId] });
    queryClient.invalidateQueries({ queryKey: ['inbox-messages'] });
  }

  const confirmProposal = useTrackedMutation({
    activityLabel: 'Confirming application update',
    successMessage: 'Application updated',
    mutationFn: (proposalId: string) => inboxApi.confirmTransitionProposal(proposalId),
    onSuccess: invalidate,
  });

  const rejectProposal = useTrackedMutation({
    activityLabel: 'Dismissing suggested update',
    successMessage: 'Suggested update dismissed',
    mutationFn: (proposalId: string) => inboxApi.rejectTransitionProposal(proposalId),
    onSuccess: invalidate,
  });

  return { confirmProposal, rejectProposal };
}
