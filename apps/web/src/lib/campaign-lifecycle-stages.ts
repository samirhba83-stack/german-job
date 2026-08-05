import { CampaignStatus } from '@german-job-engine/shared-types';
import type { CampaignDto, CampaignTimelineEntryDto } from '@/features/campaigns/types';
import type { ExecutionStage } from '@/components/shell/execution-stage-list';
import { getMissionStatus } from './mission-status';

/** The real "happy path" through the 10-state CampaignStatus enum
 * (packages/shared-types/src/enums/campaign-status.enum.ts). `PAUSED`/`COOLING_DOWN`/`RESUMING`
 * are real, but they're sub-states of *being in* the Running phase, not separate stages a
 * campaign "arrives at" and leaves — they're folded into the Running stage below, with that
 * stage's `explanation`/`recommendedNextAction` reflecting whichever of the three is actually
 * current, sourced from the same `getMissionStatus()` this codebase already uses everywhere else
 * a CampaignStatus needs human-readable framing (docs/interaction-framework/05-mission-status.md).
 */
const HAPPY_PATH = [CampaignStatus.DRAFT, CampaignStatus.READY, CampaignStatus.RUNNING, CampaignStatus.COMPLETED] as const;

const STAGE_LABEL: Record<(typeof HAPPY_PATH)[number], string> = {
  [CampaignStatus.DRAFT]: 'Draft',
  [CampaignStatus.READY]: 'Ready',
  [CampaignStatus.RUNNING]: 'Running',
  [CampaignStatus.COMPLETED]: 'Completed',
};

function isHappyPathStatus(status: CampaignStatus): status is (typeof HAPPY_PATH)[number] {
  return (HAPPY_PATH as readonly CampaignStatus[]).includes(status);
}

/** Finds which happy-path stage a real, off-path status (Paused/CoolingDown/Resuming/Stopped/
 * Cancelled/Archived) diverged from — using the real timeline's `previousState` field rather than
 * assuming it was always Running. A campaign can be genuinely cancelled from Draft or Ready, and
 * that's a real, different picture than being cancelled mid-Running; this reads real evidence to
 * tell the two apart instead of guessing. */
function resolveEffectiveIndex(currentStatus: CampaignStatus, timeline: CampaignTimelineEntryDto[]): number {
  if (isHappyPathStatus(currentStatus)) return HAPPY_PATH.indexOf(currentStatus);

  const transitionIn = [...timeline].reverse().find((entry) => entry.currentState === currentStatus);
  const previous = transitionIn?.previousState;
  if (previous && isHappyPathStatus(previous)) return HAPPY_PATH.indexOf(previous);
  return HAPPY_PATH.indexOf(CampaignStatus.RUNNING);
}

/** Whether the campaign's real path represents a failure to reach its goal, for stage coloring.
 * Archived is only a failure-path if the real transition into it came from anywhere other than a
 * successful Completed — evidence-based, not assumed. */
function isFailurePath(currentStatus: CampaignStatus, timeline: CampaignTimelineEntryDto[]): boolean {
  if (currentStatus === CampaignStatus.STOPPED || currentStatus === CampaignStatus.CANCELLED) return true;
  if (currentStatus === CampaignStatus.ARCHIVED) {
    const transitionIn = [...timeline].reverse().find((entry) => entry.currentState === CampaignStatus.ARCHIVED);
    return transitionIn?.previousState !== CampaignStatus.COMPLETED;
  }
  return false;
}

/**
 * Maps a campaign's real current status plus its real transition timeline
 * (`GET /campaigns/:id/timeline`) into `ExecutionStage[]`, reusing the same generic
 * `ExecutionStageList` component the Application lifecycle already renders through
 * (`lib/application-lifecycle-stages.ts`) rather than building a parallel visualization. Every
 * `occurredAt` is a real, recorded transition timestamp — `Draft`'s falls back to the campaign's
 * own real `createdAt` only when no explicit transition-into-Draft entry exists, since being
 * drafted is the act of creation, not a fabricated time.
 */
export function toCampaignLifecycleStages(campaign: CampaignDto, timeline: CampaignTimelineEntryDto[]): ExecutionStage[] {
  const currentStatus = campaign.status;
  const currentIndex = resolveEffectiveIndex(currentStatus, timeline);
  const failed = isFailurePath(currentStatus, timeline);

  return HAPPY_PATH.map((status, index) => {
    const transition = timeline.find((entry) => entry.currentState === status);
    const occurredAt = transition?.timestamp ?? (status === CampaignStatus.DRAFT ? campaign.createdAt : undefined);
    const isCurrent = index === currentIndex;

    let stageStatus: ExecutionStage['status'] = 'pending';
    if (index < currentIndex) {
      stageStatus = 'complete';
    } else if (isCurrent) {
      stageStatus = status === CampaignStatus.COMPLETED ? 'complete' : failed ? 'failed' : 'active';
    }

    const descriptor = isCurrent ? getMissionStatus(currentStatus) : null;

    return {
      id: status,
      label: STAGE_LABEL[status],
      status: stageStatus,
      occurredAt,
      explanation: descriptor?.explanation,
      recommendedNextAction: descriptor?.recommendedAction ?? undefined,
    };
  });
}
