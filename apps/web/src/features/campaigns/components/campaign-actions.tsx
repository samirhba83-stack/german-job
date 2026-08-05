'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { humanizeStatus } from '@/lib/status-mappings';
import { useCampaignActions } from '../hooks/use-campaign-actions';
import { CampaignReasonCode, CampaignStatus } from '../types';
import type { CampaignDto } from '../types';

const REASON_OPTIONS = Object.values(CampaignReasonCode);

/**
 * docs/campaign-workspace/. Real lifecycle actions wired to the real
 * `POST /campaigns/:id/{start,pause,resume,cancel,complete,archive}` endpoints via
 * `useCampaignActions` (`useTrackedMutation` underneath — every action gets a real Background
 * Activity Center entry and toast, no bespoke feedback code). Which buttons render is a real,
 * if approximate, client-side UX guide derived from the campaign's own real `status`/`isTerminal`
 * fields — the backend's own command handlers remain the actual authority and will reject an
 * invalid transition with a real error surfaced through the same toast mechanism; this doesn't
 * try to be a perfect client-side replica of every server-side guard.
 *
 * `retry`/`replay` are not exposed here — see `use-campaign-actions.ts` for why.
 */
export function CampaignActions({ campaign }: { campaign: CampaignDto }) {
  const { start, pause, resume, cancel, complete, archive } = useCampaignActions(campaign.id);
  const [cancelling, setCancelling] = useState(false);
  const [reasonCode, setReasonCode] = useState<CampaignReasonCode>(CampaignReasonCode.CANDIDATE_REQUEST);
  const [reasonNote, setReasonNote] = useState('');
  const reasonSelectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (cancelling) reasonSelectRef.current?.focus();
  }, [cancelling]);

  const canStart = campaign.status === CampaignStatus.DRAFT || campaign.status === CampaignStatus.READY;
  const canPause = campaign.status === CampaignStatus.RUNNING;
  const canResume =
    campaign.status === CampaignStatus.PAUSED ||
    campaign.status === CampaignStatus.COOLING_DOWN ||
    campaign.status === CampaignStatus.STOPPED;
  const canComplete = campaign.status === CampaignStatus.RUNNING;
  const canArchive = campaign.isTerminal && campaign.status !== CampaignStatus.ARCHIVED;
  const canCancel = !campaign.isTerminal;
  const hasAnyAction = canStart || canPause || canResume || canComplete || canArchive || canCancel;

  if (!hasAnyAction) {
    // The only real, reachable case: a campaign already ARCHIVED (every other status has at
    // least one valid real transition). An empty action row with no explanation would be exactly
    // the "black box" this platform's Trust Layer principle forbids (docs/interaction-framework/
    // 02-interaction-principles.md) — state the real reason instead of rendering nothing.
    return <p className="text-body-sm text-secondary">This campaign is archived — no further actions are available.</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canStart && (
        <Button size="sm" loading={start.isPending} onClick={() => start.mutate(undefined)}>
          Start
        </Button>
      )}
      {canPause && (
        <Button size="sm" variant="secondary" loading={pause.isPending} onClick={() => pause.mutate({})}>
          Pause
        </Button>
      )}
      {canResume && (
        <Button size="sm" variant="secondary" loading={resume.isPending} onClick={() => resume.mutate({})}>
          Resume
        </Button>
      )}
      {canComplete && (
        <Button size="sm" variant="secondary" loading={complete.isPending} onClick={() => complete.mutate(undefined)}>
          Mark completed
        </Button>
      )}
      {canArchive && (
        <Button size="sm" variant="secondary" loading={archive.isPending} onClick={() => archive.mutate({})}>
          Archive
        </Button>
      )}
      {canCancel && !cancelling && (
        <Button size="sm" variant="destructive" onClick={() => setCancelling(true)}>
          Cancel
        </Button>
      )}
      {canCancel && cancelling && (
        <div className="flex w-full flex-col gap-3 rounded-md border border-border bg-surface p-3 sm:flex-row sm:items-end">
          <NativeSelect
            label="Reason"
            ref={reasonSelectRef}
            value={reasonCode}
            onChange={(event) => setReasonCode(event.target.value as CampaignReasonCode)}
          >
            {REASON_OPTIONS.map((code) => (
              <option key={code} value={code}>
                {humanizeStatus(code)}
              </option>
            ))}
          </NativeSelect>
          <Input
            label="Note (optional)"
            value={reasonNote}
            onChange={(event) => setReasonNote(event.target.value)}
            maxLength={1000}
            className="sm:w-64"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              loading={cancel.isPending}
              onClick={() =>
                cancel.mutate(
                  { reasonCode, reasonNote: reasonNote.trim() || undefined },
                  { onSuccess: () => setCancelling(false) },
                )
              }
            >
              Confirm cancel
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCancelling(false)}>
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
