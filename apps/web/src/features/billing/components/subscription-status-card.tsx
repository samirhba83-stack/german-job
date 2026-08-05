'use client';

import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DefinitionField } from '@/components/ui/definition-field';
import { SUBSCRIPTION_STATUS_TONE, humanizeStatus } from '@/lib/status-mappings';
import { formatDate } from '@/lib/format-date';
import type { SubscriptionDto } from '../types';

interface SubscriptionStatusCardProps {
  subscription: SubscriptionDto | null;
  /** Real, server-computed explanation of the current state (`BillingResponseMapper.explain`) —
   * rendered verbatim rather than re-derived client-side, so it can never disagree with the
   * backend's own reasoning. */
  explanation: string;
  onCancel: (reason: string | undefined) => void;
  onResume: () => void;
  cancelPending: boolean;
  resumePending: boolean;
}

/**
 * The Billing Workspace's status summary — every field is a real `SubscriptionDto` value, and the
 * only two actions offered (cancel, resume) are exactly the two real transitions
 * `CancellationService` supports from the frontend today (Phase 11: cancellation is always
 * end-of-period, never immediate — there is no "cancel now" button because the backend has no such
 * operation for a user-initiated request).
 */
export function SubscriptionStatusCard({ subscription, explanation, onCancel, onResume, cancelPending, resumePending }: SubscriptionStatusCardProps) {
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const reasonInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cancelling) reasonInputRef.current?.focus();
  }, [cancelling]);

  const canCancel = subscription !== null && (subscription.status === 'ACTIVE' || subscription.status === 'PAST_DUE');
  const canResume = subscription !== null && subscription.cancelAtPeriodEnd;

  return (
    <Card padding="lg" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-heading-md font-semibold text-primary">Subscription status</h2>
        <Badge tone={subscription ? SUBSCRIPTION_STATUS_TONE[subscription.status] : 'neutral'}>
          {subscription ? humanizeStatus(subscription.status) : 'Free plan'}
        </Badge>
      </div>

      <p className="text-body-sm text-secondary">{explanation}</p>

      {subscription && (
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <DefinitionField label="Current period started" value={formatDate(subscription.currentPeriodStart)} />
          <DefinitionField
            label={subscription.cancelAtPeriodEnd ? 'Access ends' : 'Renews on'}
            value={formatDate(subscription.currentPeriodEnd)}
          />
          {subscription.gracePeriodEndsAt && (
            <DefinitionField label="Payment grace period ends" value={formatDate(subscription.gracePeriodEndsAt)} />
          )}
        </dl>
      )}

      {canCancel && !cancelling && (
        <Button size="sm" variant="destructive" onClick={() => setCancelling(true)}>
          Cancel subscription
        </Button>
      )}

      {canCancel && cancelling && (
        <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-3 sm:flex-row sm:items-end">
          <Input
            label="Reason (optional)"
            ref={reasonInputRef}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            className="sm:w-72"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              loading={cancelPending}
              onClick={() => {
                onCancel(reason.trim() || undefined);
                setCancelling(false);
              }}
            >
              Confirm cancellation
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCancelling(false)}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {canResume && (
        <Button size="sm" variant="secondary" loading={resumePending} onClick={onResume}>
          Undo cancellation
        </Button>
      )}
    </Card>
  );
}
