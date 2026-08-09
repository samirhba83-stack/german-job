import { ApplicationLifecycleStatus } from '@german-job-engine/shared-types';
import { Actor } from '../value-objects/actor.vo';

export interface PolicyDecision {
  readonly allowed: boolean;
  readonly reasonCode: string;
  readonly explanation: string;
}

export function allow(reasonCode: string, explanation: string): PolicyDecision {
  return { allowed: true, reasonCode, explanation };
}

export function deny(reasonCode: string, explanation: string): PolicyDecision {
  return { allowed: false, reasonCode, explanation };
}

/**
 * A named, independently testable authority — not logic buried inline in a transition method.
 * The state graph itself is enforced by CanTransitionSpecification inside the aggregate; a
 * policy governs the rules that are genuinely pluggable rather than structural (who may act,
 * what must accompany the action).
 *
 * `companyOwnerId`/`hasReason` (M31.1) — added for `ArchivalPolicy`'s real ownership/reason
 * enforcement; every other existing policy's own `authorize()` signature stays narrower (TS
 * method-shorthand bivariance allows this, matching every policy already implemented before this
 * change) and simply never reads these two fields.
 */
export interface ApplicationPolicy {
  readonly name: string;
  authorize(context: {
    actor: Actor;
    candidateId: string;
    currentState: ApplicationLifecycleStatus;
    targetState: ApplicationLifecycleStatus;
    companyOwnerId: string | null;
    hasReason: boolean;
  }): PolicyDecision;
}
