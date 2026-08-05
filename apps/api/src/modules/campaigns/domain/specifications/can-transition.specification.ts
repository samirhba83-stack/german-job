import { CampaignStatus } from '@german-job-engine/shared-types';

const S = CampaignStatus;

/**
 * The full Campaign state graph — a hub-and-exit-lanes shape, not a strict chain.
 * Paused/CoolingDown/Resuming cycle back to Running; Completed/Stopped/Cancelled are
 * independent exit lanes; Archived is the universal terminal sink.
 */
const TRANSITION_GRAPH: Record<CampaignStatus, ReadonlyArray<CampaignStatus>> = {
  [S.DRAFT]: [S.READY, S.CANCELLED, S.ARCHIVED],
  [S.READY]: [S.RUNNING, S.DRAFT, S.CANCELLED, S.ARCHIVED],
  [S.RUNNING]: [S.PAUSED, S.COOLING_DOWN, S.COMPLETED, S.STOPPED, S.CANCELLED, S.ARCHIVED],
  [S.PAUSED]: [S.RESUMING, S.STOPPED, S.CANCELLED, S.ARCHIVED],
  [S.COOLING_DOWN]: [S.RESUMING, S.STOPPED, S.CANCELLED, S.ARCHIVED],
  [S.RESUMING]: [S.RUNNING, S.STOPPED, S.CANCELLED, S.ARCHIVED],
  [S.COMPLETED]: [S.ARCHIVED],
  [S.STOPPED]: [S.RESUMING, S.CANCELLED, S.ARCHIVED],
  [S.CANCELLED]: [S.ARCHIVED],
  [S.ARCHIVED]: [],
};

export class CanTransitionSpecification {
  static isSatisfiedBy(from: CampaignStatus, to: CampaignStatus): boolean {
    return TRANSITION_GRAPH[from].includes(to);
  }

  static allowedTargets(from: CampaignStatus): ReadonlyArray<CampaignStatus> {
    return TRANSITION_GRAPH[from];
  }
}
