'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { humanizeStatus } from '@/lib/status-mappings';
import { useInboxMessageActions } from '../hooks/use-inbox-message-actions';
import type { InboxMessageDto, ReplyPrimaryCategory } from '../types';

const CORRECTABLE_CATEGORIES: ReplyPrimaryCategory[] = [
  'INTERVIEW_INVITATION',
  'ACCEPTANCE_OR_OFFER',
  'REJECTION',
  'DOCUMENT_REQUEST',
  'INFORMATION_REQUEST',
  'AVAILABILITY_REQUEST',
  'ASSESSMENT_OR_TEST_INVITATION',
  'APPLICATION_RECEIVED_CONFIRMATION',
  'APPLICATION_UNDER_REVIEW',
  'WAITLIST_OR_DELAY',
  'REFERRAL_TO_OTHER_POSITION',
  'WITHDRAWAL_CONFIRMATION',
  'SPAM_OR_UNRELATED',
];

/**
 * M29 Phase 19 — the real "tell us we got this wrong" control. Every correction is recorded as a
 * new row (never rewrites the original automated result — `InboxMessageCorrectionDto`), matching
 * the backend's own "corrections recorded without rewriting historical truth" non-negotiable.
 */
export function InboxCorrectionPanel({ message }: { message: InboxMessageDto }) {
  const { correctClassification, markUnrelated } = useInboxMessageActions(message.id);
  const [category, setCategory] = useState<ReplyPrimaryCategory>(message.primaryCategory ?? 'NEEDS_MANUAL_REVIEW');
  const [reason, setReason] = useState('');
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
          This isn&apos;t right
        </Button>
        {message.correlationStatus !== 'UNRELATED' && (
          <Button size="sm" variant="ghost" loading={markUnrelated.isPending} onClick={() => markUnrelated.mutate(undefined)}>
            Mark as unrelated
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card padding="md" className="space-y-3">
      <NativeSelect label="Correct category" value={category} onChange={(event) => setCategory(event.target.value as ReplyPrimaryCategory)}>
        {CORRECTABLE_CATEGORIES.map((value) => (
          <option key={value} value={value}>
            {humanizeStatus(value)}
          </option>
        ))}
      </NativeSelect>
      <label className="flex flex-col gap-1.5">
        <span className="text-caption font-semibold uppercase tracking-wide text-secondary">Reason (optional)</span>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={2}
          className="rounded-md border border-border bg-surface px-3 py-2 text-body-sm text-primary focus-visible:border-border-focus"
        />
      </label>
      <div className="flex gap-2">
        <Button
          size="sm"
          loading={correctClassification.isPending}
          onClick={() => {
            correctClassification.mutate({ category, reason: reason || undefined }, { onSuccess: () => setEditing(false) });
          }}
        >
          Save correction
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
