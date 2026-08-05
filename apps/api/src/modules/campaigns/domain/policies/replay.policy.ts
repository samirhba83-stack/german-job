import { CampaignTargetStatus } from '@german-job-engine/shared-types';
import { CampaignTarget } from '../entities/campaign-target.entity';

/**
 * Structurally filters replay scope to targets that are NOT dispatched — completed work is
 * never re-included, enforced by the policy itself rather than by operator discipline.
 */
export class ReplayPolicy {
  eligibleTargets(targets: ReadonlyArray<CampaignTarget>): ReadonlyArray<CampaignTarget> {
    return targets.filter((target) => target.status !== CampaignTargetStatus.DISPATCHED);
  }
}
