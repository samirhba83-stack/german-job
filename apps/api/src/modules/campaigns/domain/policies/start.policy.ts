import { CampaignLifecycleContext, CampaignLifecyclePolicy, PolicyDecision, allow } from './campaign-policy.interface';

export class StartPolicy implements CampaignLifecyclePolicy {
  authorize(_context: CampaignLifecycleContext): PolicyDecision {
    return allow();
  }
}
