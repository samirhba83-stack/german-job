import { ApplicationLifecycleStatus } from '@german-job-engine/shared-types';
import type { ExecutionStage } from '@/components/shell/execution-stage-list';

/** The subset of the real 15-state Application lifecycle that reads naturally as a linear
 * "sending" sequence — matches several of the milestone's own example stages (Preparing Email,
 * Sending Email, Waiting Delivery Confirmation) with real, live backend states, rather than the
 * dormant pipeline-internal stages (Analyzing Companies, Generating CV Package) that have no
 * controller yet. Post-delivery states (OPENED, VIEWED, COMPANY_REPLIED, ...) branch beyond this
 * linear view and are shown separately by the real timeline/history endpoints
 * (docs/frontend-architecture §1.7), not forced into this sequence. */
const SEND_SEQUENCE = [
  ApplicationLifecycleStatus.DRAFT,
  ApplicationLifecycleStatus.PREPARED,
  ApplicationLifecycleStatus.QUEUED,
  ApplicationLifecycleStatus.SENT,
  ApplicationLifecycleStatus.DELIVERED,
] as const;

const STAGE_LABEL: Record<(typeof SEND_SEQUENCE)[number], string> = {
  [ApplicationLifecycleStatus.DRAFT]: 'Preparing application',
  [ApplicationLifecycleStatus.PREPARED]: 'Application prepared',
  [ApplicationLifecycleStatus.QUEUED]: 'Queued for delivery',
  [ApplicationLifecycleStatus.SENT]: 'Sending',
  [ApplicationLifecycleStatus.DELIVERED]: 'Delivery confirmed',
};

interface TimelineTransition {
  status: string;
  occurredAt: string;
  /** Real, optional `TransitionReason.note` — set by an actor or policy, never synthesized here. */
  reasonNote?: string | null;
  /** Real, optional `EvidenceReference` — set only when the transition genuinely has one
   * (e.g. a delivery-provider receipt), never synthesized here. */
  evidence?: { type: string; externalId: string; url: string | null } | null;
}

/**
 * Maps an application's real current status plus its real transition timeline
 * (GET /applications/:id/timeline, docs/frontend-architecture §1.7) into ExecutionStage[] — every
 * `occurredAt` here is a real, recorded transition timestamp; a stage with no matching timeline
 * entry is rendered `pending`, never given a fabricated time. `explanation`/`evidence` are wired
 * straight through from the same real timeline entry's `reasonNote`/`evidence` — omitted, not
 * guessed, when the entry has neither (Milestone 22.2). `recommendedNextAction` is never set: no
 * backend field for it exists on a timeline entry today.
 */
export function toSendExecutionStages(
  currentStatus: ApplicationLifecycleStatus,
  timeline: TimelineTransition[],
): ExecutionStage[] {
  const currentIndex = SEND_SEQUENCE.indexOf(currentStatus as (typeof SEND_SEQUENCE)[number]);

  return SEND_SEQUENCE.map((status, index) => {
    const transition = timeline.find((entry) => entry.status === status);
    const isFailedTerminal =
      currentIndex === -1 &&
      (currentStatus === ApplicationLifecycleStatus.REJECTED || currentStatus === ApplicationLifecycleStatus.WITHDRAWN);

    let stageStatus: ExecutionStage['status'] = 'pending';
    if (transition) {
      stageStatus = 'complete';
    } else if (currentIndex !== -1 && index === currentIndex) {
      stageStatus = 'active';
    } else if (isFailedTerminal) {
      stageStatus = 'failed';
    }

    return {
      id: status,
      label: STAGE_LABEL[status],
      status: stageStatus,
      occurredAt: transition?.occurredAt,
      explanation: transition?.reasonNote ?? undefined,
      evidence: transition?.evidence ?? undefined,
    };
  });
}
