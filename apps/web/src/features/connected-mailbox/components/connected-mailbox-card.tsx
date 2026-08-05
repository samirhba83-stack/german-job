'use client';

import { useState } from 'react';
import { Mail, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DefinitionField } from '@/components/ui/definition-field';
import { CONNECTED_MAILBOX_STATUS_TONE, humanizeStatus } from '@/lib/status-mappings';
import { formatDateTime } from '@/lib/format-date';
import { useMailboxActions } from '../hooks/use-mailbox-actions';
import type { ConnectedMailboxDto } from '../types';
import type { MailboxProviderSlug } from '../api/connected-mailbox.api';

const PROVIDER_LABEL: Record<ConnectedMailboxDto['provider'], string> = {
  GOOGLE_GMAIL: 'Gmail',
  MICROSOFT_OUTLOOK: 'Outlook',
};

const CONSENT_DISCLOSURE_POINTS = [
  'Applications you send will use this mailbox as the visible sender — the receiving company sees your real address, not a platform address.',
  'Replies go straight to this mailbox, the same as if you had sent the email yourself.',
  'We request only the permission to send mail on your behalf and to read your own address to verify it — never access to read your inbox.',
  'You can disconnect at any time from this page; sending stops immediately.',
];

/** Real "Connect Gmail" / "Connect Outlook" buttons — navigates the browser to the real provider
 * consent screen returned by `POST /mailbox-connections/:provider/start` (same pattern as
 * billing checkout's `checkoutUrl` redirect). Exactly two providers, hardcoded rather than
 * data-driven — matching Phase 4's fixed, deliberately-not-extensible provider set. */
function ConnectMailboxPanel() {
  const { startConnection } = useMailboxActions();
  const [pendingProvider, setPendingProvider] = useState<MailboxProviderSlug | null>(null);

  function connect(provider: MailboxProviderSlug) {
    setPendingProvider(provider);
    startConnection.mutate(provider, {
      onSuccess: (result) => {
        window.location.href = result.authorizationUrl;
      },
      onError: () => setPendingProvider(null),
    });
  }

  return (
    <Card padding="lg" className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/10">
          <Mail className="h-5 w-5 text-accent" aria-hidden="true" strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="text-heading-md font-semibold text-primary">Connect your email</h2>
          <p className="text-body-sm text-secondary">No mailbox connected yet — applications can&apos;t be sent until you connect one.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button loading={pendingProvider === 'google'} disabled={startConnection.isPending} onClick={() => connect('google')}>
          Connect Gmail
        </Button>
        <Button
          variant="secondary"
          loading={pendingProvider === 'microsoft'}
          disabled={startConnection.isPending}
          onClick={() => connect('microsoft')}
        >
          Connect Outlook
        </Button>
      </div>

      <div className="space-y-2 rounded-md border border-border bg-background-subtle p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-secondary" aria-hidden="true" strokeWidth={1.75} />
          <p className="text-body-sm font-semibold text-primary">What connecting means</p>
        </div>
        <ul className="list-disc space-y-1 pl-5 text-body-sm text-secondary">
          {CONSENT_DISCLOSURE_POINTS.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

interface ConnectedMailboxStatusCardProps {
  mailbox: ConnectedMailboxDto;
}

/** The real status view once a mailbox is connected — every field is a real `ConnectedMailboxDto`
 * value, no fabricated health/reputation scoring. Reauthorization/suspension get an explicit,
 * explained banner rather than a bare status badge, matching `SubscriptionStatusCard`'s
 * "explanation" precedent for a non-obvious state. */
function ConnectedMailboxStatusCard({ mailbox }: ConnectedMailboxStatusCardProps) {
  const { disconnect } = useMailboxActions();
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);

  return (
    <Card padding="lg" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/10">
            <Mail className="h-5 w-5 text-accent" aria-hidden="true" strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="text-heading-md font-semibold text-primary">{mailbox.emailAddress}</h2>
            <p className="text-body-sm text-secondary">Connected via {PROVIDER_LABEL[mailbox.provider]}</p>
          </div>
        </div>
        <Badge tone={CONNECTED_MAILBOX_STATUS_TONE[mailbox.status]}>{humanizeStatus(mailbox.status)}</Badge>
      </div>

      {mailbox.status === 'REAUTHORIZATION_REQUIRED' && (
        <div className="rounded-md border border-status-warning/30 bg-status-warning/10 p-3 text-body-sm text-status-warning">
          This mailbox needs to be reconnected before it can send again — your permission may have expired or been changed.
          Disconnect it below, then connect it again.
        </div>
      )}
      {mailbox.status === 'SYSTEM_SUSPENDED' && (
        <div className="rounded-md border border-status-critical/30 bg-status-critical/10 p-3 text-body-sm text-status-critical">
          Sending from this mailbox is paused for a safety review{mailbox.suspensionReason ? `: ${mailbox.suspensionReason}` : '.'}
        </div>
      )}

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <DefinitionField label="Connected" value={mailbox.connectedAt ? formatDateTime(mailbox.connectedAt) : 'Not yet completed'} />
        <DefinitionField
          label="Last successful send"
          value={mailbox.lastSuccessfulSendAt ? formatDateTime(mailbox.lastSuccessfulSendAt) : 'No applications sent yet'}
        />
        <DefinitionField label="Sent today" value={String(mailbox.dailySendCount)} />
        {mailbox.lastFailureAt && (
          <DefinitionField label="Last failure" value={`${formatDateTime(mailbox.lastFailureAt)}${mailbox.failureReason ? ` — ${mailbox.failureReason}` : ''}`} />
        )}
      </dl>

      {!confirmingDisconnect && (
        <Button size="sm" variant="destructive" onClick={() => setConfirmingDisconnect(true)}>
          Disconnect mailbox
        </Button>
      )}
      {confirmingDisconnect && (
        <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-3 sm:flex-row sm:items-center">
          <p className="text-body-sm text-secondary">Applications won&apos;t be sendable until you connect a mailbox again.</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              loading={disconnect.isPending}
              onClick={() => {
                disconnect.mutate(mailbox.id);
                setConfirmingDisconnect(false);
              }}
            >
              Confirm disconnect
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmingDisconnect(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export function ConnectedMailboxCard({ mailbox }: { mailbox: ConnectedMailboxDto | null }) {
  return mailbox ? <ConnectedMailboxStatusCard mailbox={mailbox} /> : <ConnectMailboxPanel />;
}
