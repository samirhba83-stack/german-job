import { CampaignLifecycleContext, CampaignLifecyclePolicy, PolicyDecision, allow } from './campaign-policy.interface';

/**
 * Governs actor eligibility for Draft → Ready. The structural precondition (≥1 target, a
 * valid goal/strategy/execution window) is enforced separately by the aggregate's
 * `requireAtLeastOneTarget()` guard — this policy is the extension point for future
 * role-based readiness rules.
 */
export class ReadinessPolicy implements CampaignLifecyclePolicy {
  authorize(_context: CampaignLifecycleContext): PolicyDecision {
    return allow();
  }
}
