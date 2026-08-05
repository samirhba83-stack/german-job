import { CampaignLifecycleContext, CampaignLifecyclePolicy, PolicyDecision, allow } from './campaign-policy.interface';

export class PausePolicy implements CampaignLifecyclePolicy {
  authorize(_context: CampaignLifecycleContext): PolicyDecision {
    return allow();
  }
}
