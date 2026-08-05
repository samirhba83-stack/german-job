'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { humanizeStatus } from '@/lib/status-mappings';
import { useTransitionProposalActions } from '../hooks/use-transition-proposal-actions';
import type { ApplicationTransitionProposalDto } from '../types';

const PROPOSAL_STATUS_TONE = { PENDING: 'warning', CONFIRMED: 'positive', REJECTED: 'neutral' } as const;

/**
 * M29 Phase 14 — every proposed application-status change, shown with its real evidence and
 * confidence (Non-Negotiable Principle: "every automated conclusion must expose evidence and
 * confidence"), requiring an explicit click to actually apply — except a proposal already
 * `AUTO_ACCEPTED` server-side (the narrow deterministic delivery-failure case), which has no
 * PENDING status left to act on.
 */
export function TransitionProposalPanel({ messageId, proposal }: { messageId: string; proposal: ApplicationTransitionProposalDto }) {
  const { confirmProposal, rejectProposal } = useTransitionProposalActions(messageId);

  return (
    <Card padding="md" className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-body font-medium text-primary">Suggested update: {humanizeStatus(proposal.proposedAction)}</p>
        <Badge tone={PROPOSAL_STATUS_TONE[proposal.status]}>{humanizeStatus(proposal.status)}</Badge>
      </div>
      {proposal.confidence !== null && <p className="text-caption text-secondary">Confidence: {Math.round(proposal.confidence * 100)}%</p>}
      {proposal.status === 'PENDING' && (
        <div className="flex gap-2 pt-1">
          <Button size="sm" loading={confirmProposal.isPending} onClick={() => confirmProposal.mutate(proposal.id)}>
            Confirm
          </Button>
          <Button size="sm" variant="secondary" loading={rejectProposal.isPending} onClick={() => rejectProposal.mutate(proposal.id)}>
            Dismiss
          </Button>
        </div>
      )}
    </Card>
  );
}
