'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTrackedMutation } from '@/lib/hooks/use-tracked-mutation';
import * as inboxApi from '../api/inbox.api';
import type { ReplyDraftType } from '../types';

/** Every real reply-draft write. `approveAndSend` is the ONLY path that ever actually sends
 * anything — `INBOX_AUTOMATIC_REPLY_ENABLED` stays false this milestone, so no reply is ever sent
 * without this explicit click. */
export function useReplyDraftActions(messageId: string) {
  const queryClient = useQueryClient();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['inbox-message', messageId] });
  }

  const createDraft = useTrackedMutation({
    activityLabel: 'Generating draft reply',
    successMessage: 'Draft reply generated',
    mutationFn: (input: { draftType: ReplyDraftType; candidateName: string; companyName: string; jobTitle: string }) => inboxApi.createReplyDraft(messageId, input),
    onSuccess: invalidate,
  });

  const editDraft = useTrackedMutation({
    activityLabel: 'Saving draft',
    successMessage: 'Draft saved',
    mutationFn: (input: { draftId: string; subject: string; bodyText: string }) => inboxApi.editReplyDraft(input.draftId, { subject: input.subject, bodyText: input.bodyText }),
    onSuccess: invalidate,
  });

  const approveAndSend = useTrackedMutation({
    activityLabel: 'Sending reply',
    successMessage: 'Reply sent',
    mutationFn: (input: { draftId: string; recipientEmailAddress: string }) => inboxApi.approveAndSendDraft(input.draftId, { recipientEmailAddress: input.recipientEmailAddress }),
    onSuccess: invalidate,
  });

  const discardDraft = useTrackedMutation({
    activityLabel: 'Discarding draft',
    successMessage: 'Draft discarded',
    mutationFn: (draftId: string) => inboxApi.discardReplyDraft(draftId),
    onSuccess: invalidate,
  });

  return { createDraft, editDraft, approveAndSend, discardDraft };
}
