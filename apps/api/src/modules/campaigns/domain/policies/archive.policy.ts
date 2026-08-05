import { CampaignLifecycleContext, CampaignLifecyclePolicy, PolicyDecision, allow } from './campaign-policy.interface';

/** The broadest lifecycle policy — always allowed, mirrors ArchivePolicy in the Application module. */
export class ArchivePolicy implements CampaignLifecyclePolicy {
  authorize(_context: CampaignLifecycleContext): PolicyDecision {
    return allow();
  }
}
