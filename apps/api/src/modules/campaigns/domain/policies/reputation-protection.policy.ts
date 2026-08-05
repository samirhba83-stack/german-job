import { PolicyDecision, allow } from './campaign-policy.interface';

/**
 * Reserved — structural extension point only, always-allow today. Future home for
 * sending-diversity and randomized-timing rules referenced in the approved design.
 */
export class ReputationProtectionPolicy {
  authorize(): PolicyDecision {
    return allow();
  }
}
