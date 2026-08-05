import { CampaignLifecycleContext, CampaignLifecyclePolicy, PolicyDecision, allow } from './campaign-policy.interface';

export class CompletionPolicy implements CampaignLifecyclePolicy {
  authorize(_context: CampaignLifecycleContext): PolicyDecision {
    return allow();
  }
}
