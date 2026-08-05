'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';
import { ContextHeader } from '@/components/shell/context-header';
import { TrustFeedbackCard } from '@/components/shell/trust-feedback-card';
import { ErrorState } from '@/components/shell/error-state';
import { ApiError } from '@/lib/api-client';
import { InboxConsentCard } from '@/features/inbox/components/inbox-consent-card';
import { useConnectedMailboxes } from '../hooks/use-connected-mailboxes';
import { ConnectedMailboxCard } from './connected-mailbox-card';

/** Plain-language explanation for each real failure reason `MailboxConnectionsController`'s
 * callback can redirect with (`MailboxConnectionService.ConnectionFailureReason`, plus its own
 * `missing_state` early-exit code) — never the raw machine code shown to a user. */
const FAILURE_REASON_EXPLANATION: Record<string, string> = {
  MISSING_STATE: 'The connection attempt was missing required security information. Please try connecting again.',
  INVALID_STATE: 'This authorization link is invalid or has already been used. Please try connecting again.',
  EXPIRED: 'The connection attempt expired before it was completed. Please try connecting again.',
  ALREADY_CONSUMED: 'This authorization attempt was already completed.',
  PROVIDER_ERROR: 'Authorization was not completed with the provider.',
  MISSING_CODE: 'Authorization was not completed.',
  TOKEN_EXCHANGE_FAILED: 'We could not complete authorization with the provider. Please try again.',
  SCOPE_REJECTED: 'The required permission was not granted, or additional unexpected permissions were requested — please grant exactly the requested permission.',
  IDENTITY_VERIFICATION_FAILED: 'We could not verify the connected mailbox address. Please try again.',
  NO_REFRESH_TOKEN: 'The provider did not grant persistent access — please try connecting again and accept the consent prompt fully.',
};

function explainFailure(reason: string | null): string {
  if (!reason) return 'The connection attempt did not complete.';
  return FAILURE_REASON_EXPLANATION[reason.toUpperCase()] ?? 'The connection attempt did not complete.';
}

/**
 * M28.6 Phase 7 — the real Connected Email settings section: connect Gmail/Outlook, see real
 * status, disconnect. Composed the same way as `BillingWorkspace` (M27): a `ContextHeader`, a
 * `TrustFeedbackCard` for the OAuth redirect outcome, and the real data card — no fabricated
 * "reputation score" or "deliverability rating," only fields the backend actually returns.
 */
export function ConnectedMailboxWorkspace() {
  const searchParams = useSearchParams();
  const connectionParam = searchParams.get('mailboxConnection'); // 'success' | 'failed' | null
  const failureReason = searchParams.get('reason');
  const [connectionJustCompleted] = useState(() => connectionParam === 'success');

  const mailboxesQuery = useConnectedMailboxes({ pollUntilSettled: connectionJustCompleted });

  if (mailboxesQuery.isLoading) {
    return (
      <div>
        <ContextHeader title="Settings" />
        <SkeletonRegion loading label="Loading connected email">
          <Skeleton variant="card" className="h-64" />
        </SkeletonRegion>
      </div>
    );
  }

  if (mailboxesQuery.isError || !mailboxesQuery.data) {
    return (
      <div>
        <ContextHeader title="Settings" />
        <ErrorState
          message={mailboxesQuery.error instanceof ApiError ? mailboxesQuery.error.message : 'Connected email settings could not be loaded. Please try again in a moment.'}
        />
      </div>
    );
  }

  const activeMailbox = mailboxesQuery.data.find((mailbox) => mailbox.isActive) ?? null;

  return (
    <div className="space-y-8">
      <ContextHeader title="Settings" />

      <section className="space-y-3">
        <div>
          <h2 className="text-heading-md font-semibold text-primary">Connected email</h2>
          <p className="text-body-sm text-secondary">
            Applications are sent from your own connected Gmail or Outlook mailbox — the company sees your real address, and
            replies land in your inbox.
          </p>
        </div>

        {connectionParam === 'success' && (
          <TrustFeedbackCard
            label={activeMailbox ? 'Mailbox connected' : 'Finishing connection'}
            tone={activeMailbox ? 'positive' : 'info'}
            explanation={
              activeMailbox
                ? `${activeMailbox.emailAddress} is now connected and ready to send applications.`
                : 'Finalizing your connection — this should only take a moment.'
            }
          />
        )}
        {connectionParam === 'failed' && (
          <TrustFeedbackCard label="Connection failed" tone="critical" explanation={explainFailure(failureReason)} />
        )}

        <ConnectedMailboxCard mailbox={activeMailbox} />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-heading-md font-semibold text-primary">Inbox reading</h2>
          <p className="text-body-sm text-secondary">
            A separate, optional permission: detect and classify replies to the applications you send, and suggest next steps —
            never required for sending to work.
          </p>
        </div>
        <InboxConsentCard mailbox={activeMailbox} />
      </section>
    </div>
  );
}
