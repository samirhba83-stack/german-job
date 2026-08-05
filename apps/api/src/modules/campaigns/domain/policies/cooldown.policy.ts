import { CampaignActorRole } from '@german-job-engine/shared-types';
import { CampaignLifecycleContext, CampaignLifecyclePolicy, PolicyDecision, allow, deny } from './campaign-policy.interface';

/** Cooling Down is always system/automation-triggered — never a manual candidate action. */
export class CooldownPolicy implements CampaignLifecyclePolicy {
  authorize(context: CampaignLifecycleContext): PolicyDecision {
    if (context.actor.role !== CampaignActorRole.SYSTEM && context.actor.role !== CampaignActorRole.AUTOMATION) {
      return deny('ACTOR_NOT_SYSTEM', 'Only the system or an automation engine can start a cooldown.');
    }
    return allow();
  }
}
