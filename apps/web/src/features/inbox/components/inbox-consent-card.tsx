'use client';

import { useState } from 'react';
import { Inbox, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DefinitionField } from '@/components/ui/definition-field';
import { INBOX_CAPABILITY_STATUS_TONE, humanizeStatus } from '@/lib/status-mappings';
import { formatDateTime } from '@/lib/format-date';
import { useInboxConsentActions } from '../hooks/use-inbox-consent-actions';
import type { ConnectedMailboxDto } from '@/features/connected-mailbox/types';

const INBOX_CONSENT_DISCLOSURE_POINTS = [
  'This is separate from sending — turning it on does not change how your applications are sent.',
  'Only messages that clearly relate to an application you sent are read and processed; the rest of your mailbox is never touched.',
  'We never read your entire mailbox, and unrelated personal, financial, or private conversations are never processed.',
  'Every classification and suggested update is shown to you with its evidence — nothing changes an application\'s status without your confirmation, except confirmed delivery failures.',
  'No reply is ever sent on your behalf — replies are drafted for your review and only sent when you click send.',
  'You can turn this off at any time; sending keeps working normally either way.',
];

/**
 * M29 Phase 2/17 — the real, separate inbox-reading consent upgrade, shown alongside (never
 * merged into) `ConnectedMailboxCard`'s send-connection status — the same "separate permission,
 * separate card" discipline the backend's `InboxCapabilityStatus` enforces at the data level.
 * Receives `mailbox` from `ConnectedMailboxWorkspace`'s already-fetched `GET /mailbox-connections/me`
 * query rather than issuing a second, duplicate fetch.
 */
export function InboxConsentCard({ mailbox }: { mailbox: ConnectedMailboxDto | null }) {
  const { startConsent, revokeConsent } = useInboxConsentActions();
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);

  if (!mailbox) {
    return (
      <Card padding="lg" className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-background-subtle">
            <Inbox className="h-5 w-5 text-secondary" aria-hidden="true" strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="text-heading-md font-semibold text-primary">Inbox reading</h2>
            <p className="text-body-sm text-secondary">Connect a mailbox for sending first — inbox reading is an upgrade to that connection.</p>
          </div>
        </div>
      </Card>
    );
  }

  const status = mailbox.inboxCapabilityStatus;
  const isActive = status === 'ACTIVE';
  const canRequest = status === 'NOT_REQUESTED' || status === 'REVOKED' || status === 'USER_DISABLED' || status === 'FAILED';

  return (
    <Card padding="lg" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/10">
            <Inbox className="h-5 w-5 text-accent" aria-hidden="true" strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="text-heading-md font-semibold text-primary">Inbox reading</h2>
            <p className="text-body-sm text-secondary">Detect and classify replies to applications sent from {mailbox.emailAddress}.</p>
          </div>
        </div>
        <Badge tone={INBOX_CAPABILITY_STATUS_TONE[status]}>{humanizeStatus(status)}</Badge>
      </div>

      {status === 'REAUTHORIZATION_REQUIRED' && (
        <div className="rounded-md border border-status-warning/30 bg-status-warning/10 p-3 text-body-sm text-status-warning">
          Inbox reading needs to be reauthorized — your permission may have expired or been changed. Turn it off below, then request it again.
        </div>
      )}
      {status === 'SYSTEM_SUSPENDED' && (
        <div className="rounded-md border border-status-critical/30 bg-status-critical/10 p-3 text-body-sm text-status-critical">
          Inbox reading is paused for a safety review.
        </div>
      )}

      {isActive && (
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <DefinitionField label="Turned on" value={mailbox.inboxConsentAcceptedAt ? formatDateTime(mailbox.inboxConsentAcceptedAt) : 'Just now'} />
          <DefinitionField
            label="Last checked"
            value={mailbox.lastSuccessfulInboxAccessAt ? formatDateTime(mailbox.lastSuccessfulInboxAccessAt) : 'Not yet checked'}
          />
        </dl>
      )}

      {canRequest && (
        <div className="space-y-3">
          <div className="space-y-2 rounded-md border border-border bg-background-subtle p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-secondary" aria-hidden="true" strokeWidth={1.75} />
              <p className="text-body-sm font-semibold text-primary">What turning this on means</p>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-body-sm text-secondary">
              {INBOX_CONSENT_DISCLOSURE_POINTS.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
          <Button
            loading={startConsent.isPending}
            onClick={() => startConsent.mutate(undefined, { onSuccess: (result) => { window.location.href = result.authorizationUrl; } })}
          >
            Turn on inbox reading
          </Button>
        </div>
      )}

      {isActive && !confirmingRevoke && (
        <Button size="sm" variant="destructive" onClick={() => setConfirmingRevoke(true)}>
          Turn off inbox reading
        </Button>
      )}
      {isActive && confirmingRevoke && (
        <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-3 sm:flex-row sm:items-center">
          <p className="text-body-sm text-secondary">Sending keeps working normally — only reply detection stops.</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              loading={revokeConsent.isPending}
              onClick={() => {
                revokeConsent.mutate(undefined);
                setConfirmingRevoke(false);
              }}
            >
              Confirm turn off
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmingRevoke(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
