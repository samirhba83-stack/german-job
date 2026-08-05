import { CampaignActorRole } from '@german-job-engine/shared-types';
import { CampaignLifecycleContext, CampaignLifecyclePolicy, PolicyDecision, allow, deny } from './campaign-policy.interface';

/** Only the owning candidate or an admin may cancel a campaign. */
export class CancelPolicy implements CampaignLifecyclePolicy {
  authorize(context: CampaignLifecycleContext): PolicyDecision {
    if (context.actor.role === CampaignActorRole.ADMIN) {
      return allow();
    }
    if (context.actor.role === CampaignActorRole.CANDIDATE && context.actor.actorId === context.ownerId) {
      return allow();
    }
    return deny('NOT_OWNER', 'Only the owning candidate or an admin may cancel this campaign.');
  }
}
