import { PolicyDecision, allow, deny } from './campaign-policy.interface';
import { RateLimitProfile } from '../value-objects/rate-limit-profile.vo';

/** Real, enforced spam-protection rule — pure arithmetic, no prediction. */
export class RateLimitPolicy {
  authorize(requestedSize: number, dispatchedInLast24h: number, profile: RateLimitProfile): PolicyDecision {
    if (dispatchedInLast24h + requestedSize > profile.maxPerDay) {
      return deny('RATE_LIMIT_DAILY', `Requested batch of ${requestedSize} would exceed the daily limit of ${profile.maxPerDay}.`);
    }
    return allow();
  }
}
