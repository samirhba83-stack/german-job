import { PolicyDecision, allow, deny } from './campaign-policy.interface';
import { CooldownPeriod } from '../value-objects/cooldown-period.vo';

/**
 * Governs how long an auto-triggered cooldown lasts once entered. Validated structurally
 * today (must be a well-formed CooldownPeriod); the duration itself may later be tuned by
 * a future intelligence engine, but this policy never computes it.
 */
export class CooldownWindowPolicy {
  authorize(cooldown: CooldownPeriod, referenceDate: Date = new Date()): PolicyDecision {
    if (cooldown.until <= referenceDate) {
      return deny('COOLDOWN_ALREADY_ELAPSED', 'Cooldown period must extend into the future.');
    }
    return allow();
  }
}
