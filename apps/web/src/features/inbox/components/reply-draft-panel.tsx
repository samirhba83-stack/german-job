'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { humanizeStatus } from '@/lib/status-mappings';
import { useReplyDraftActions } from '../hooks/use-reply-draft-actions';
import type { InboxMessageDto, ReplyDraftDto, ReplyDraftType } from '../types';

const DRAFT_TYPES: ReplyDraftType[] = [
  'INTERVIEW_ACCEPTANCE',
  'REQUEST_ALTERNATIVE_TIME',
  'DOCUMENT_SUBMISSION_ACKNOWLEDGMENT',
  'INFORMATION_RESPONSE',
  'POLITE_FOLLOWUP',
  'OFFER_ACKNOWLEDGMENT',
  'REJECTION_ACKNOWLEDGMENT',
];

const DRAFT_STATUS_TONE = { DRAFT: 'neutral', EDITED: 'info', APPROVED: 'info', SENT: 'positive', DISCARDED: 'neutral' } as const;

function ExistingDraft({ messageId, draft, recipientEmailAddress }: { messageId: string; draft: ReplyDraftDto; recipientEmailAddress: string }) {
  const { editDraft, approveAndSend, discardDraft } = useReplyDraftActions(messageId);
  const [subject, setSubject] = useState(draft.subject);
  const [bodyText, setBodyText] = useState(draft.bodyText);
  const [confirmingSend, setConfirmingSend] = useState(false);

  const editable = draft.status === 'DRAFT' || draft.status === 'EDITED';
  const dirty = subject !== draft.subject || bodyText !== draft.bodyText;
  const unfilledPlaceholders = draft.placeholders.filter((p) => !p.filled);

  return (
    <Card padding="md" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-body font-medium text-primary">{humanizeStatus(draft.draftType)}</p>
        <Badge tone={DRAFT_STATUS_TONE[draft.status]}>{humanizeStatus(draft.status)}</Badge>
      </div>

      {unfilledPlaceholders.length > 0 && editable && (
        <p className="text-body-sm text-status-warning">
          Fill in before sending: {unfilledPlaceholders.map((p) => p.label).join(', ')}
        </p>
      )}

      {editable ? (
        <>
          <Input label="Subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
          <label className="flex flex-col gap-1.5">
            <span className="text-caption font-semibold uppercase tracking-wide text-secondary">Body</span>
            <textarea
              value={bodyText}
              onChange={(event) => setBodyText(event.target.value)}
              rows={8}
              className="rounded-md border border-border bg-surface px-3 py-2 font-mono text-body-sm text-primary focus-visible:border-border-focus"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {dirty && (
              <Button size="sm" variant="secondary" loading={editDraft.isPending} onClick={() => editDraft.mutate({ draftId: draft.id, subject, bodyText })}>
                Save changes
              </Button>
            )}
            {!confirmingSend && (
              <Button size="sm" onClick={() => setConfirmingSend(true)}>
                Send reply
              </Button>
            )}
            <Button size="sm" variant="ghost" loading={discardDraft.isPending} onClick={() => discardDraft.mutate(draft.id)}>
              Discard
            </Button>
          </div>
          {confirmingSend && (
            <div className="flex flex-col gap-3 rounded-md border border-border bg-background-subtle p-3 sm:flex-row sm:items-center">
              <p className="text-body-sm text-secondary">
                Send this reply to {recipientEmailAddress} now? This is the only way a reply is ever sent — nothing is sent automatically.
              </p>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  loading={approveAndSend.isPending}
                  onClick={() => {
                    approveAndSend.mutate({ draftId: draft.id, recipientEmailAddress });
                    setConfirmingSend(false);
                  }}
                >
                  Confirm send
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmingSend(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-md border border-border bg-background-subtle p-3">
          <p className="text-body-sm font-medium text-primary">{subject}</p>
          <p className="whitespace-pre-wrap text-body-sm text-secondary">{bodyText}</p>
        </div>
      )}
    </Card>
  );
}

function NewDraftForm({ message }: { message: InboxMessageDto }) {
  const { createDraft } = useReplyDraftActions(message.id);
  const [draftType, setDraftType] = useState<ReplyDraftType>('POLITE_FOLLOWUP');
  const [candidateName, setCandidateName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [jobTitle, setJobTitle] = useState('');

  return (
    <Card padding="md" className="space-y-3">
      <p className="text-body-sm text-secondary">Generate a draft reply — nothing is sent until you review and click send.</p>
      <NativeSelect label="Reply type" value={draftType} onChange={(event) => setDraftType(event.target.value as ReplyDraftType)}>
        {DRAFT_TYPES.map((value) => (
          <option key={value} value={value}>
            {humanizeStatus(value)}
          </option>
        ))}
      </NativeSelect>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input label="Your name" value={candidateName} onChange={(event) => setCandidateName(event.target.value)} />
        <Input label="Company name" value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
        <Input label="Job title" value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} />
      </div>
      <Button
        size="sm"
        disabled={!candidateName || !companyName || !jobTitle}
        loading={createDraft.isPending}
        onClick={() => createDraft.mutate({ draftType, candidateName, companyName, jobTitle })}
      >
        Generate draft
      </Button>
    </Card>
  );
}

export function ReplyDraftPanel({ message, drafts }: { message: InboxMessageDto; drafts: ReplyDraftDto[] }) {
  const activeDrafts = drafts.filter((d) => d.status !== 'DISCARDED');

  return (
    <div className="space-y-3">
      {activeDrafts.map((draft) => (
        <ExistingDraft key={draft.id} messageId={message.id} draft={draft} recipientEmailAddress={message.fromAddress} />
      ))}
      <NewDraftForm message={message} />
    </div>
  );
}
