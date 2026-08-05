import { ReplyPrimaryCategory } from '../models/reply-taxonomy';
import { HIGH_IMPACT_CATEGORIES } from '../models/reply-taxonomy';

export type ConfidenceBand = 'HIGH' | 'MEDIUM' | 'LOW';

export interface DecisionPolicyConfig {
  readonly highConfidenceThreshold: number;
  readonly mediumConfidenceThreshold: number;
}

export interface ReplyDecisionOutcome {
  readonly confidenceBand: ConfidenceBand;
  /** Whether an `ApplicationTransitionProposal` should even be created at all — LOW confidence
   * never proposes anything (Phase 12: "mark NEEDS_MANUAL_REVIEW, do not change application
   * state"). */
  readonly shouldProposeTransition: boolean;
  /** Whether that proposal (if created) may be auto-confirmed without a human click — Phase 12:
   * never true for a `HIGH_IMPACT_CATEGORIES` member regardless of confidence; true only for the
   * narrow deterministic-delivery-failure-shaped case at HIGH confidence. */
  readonly requiresExplicitConfirmation: boolean;
  readonly reviewStatus: 'PENDING_REVIEW' | 'CONFIRMED' | 'AUTO_ACCEPTED';
}

const DEFAULT_CONFIG: DecisionPolicyConfig = { highConfidenceThreshold: 0.85, mediumConfidenceThreshold: 0.55 };

function bandFor(confidence: number, config: DecisionPolicyConfig): ConfidenceBand {
  if (confidence >= config.highConfidenceThreshold) return 'HIGH';
  if (confidence >= config.mediumConfidenceThreshold) return 'MEDIUM';
  return 'LOW';
}

/**
 * M29 Phase 12 — the one authoritative policy translating (category, confidence) into what the
 * rest of the system is allowed to do automatically. Never itself calls anything — a pure
 * function callers act on. `DELIVERY_FAILURE` is the one category Phase 12 explicitly allows to
 * auto-apply ("deterministic delivery failures may update delivery state automatically, not
 * candidate employment outcome") since it updates delivery status, never an employment outcome.
 */
export function decideReplyAction(category: ReplyPrimaryCategory, confidence: number, config: DecisionPolicyConfig = DEFAULT_CONFIG): ReplyDecisionOutcome {
  const confidenceBand = bandFor(confidence, config);

  if (confidenceBand === 'LOW') {
    return { confidenceBand, shouldProposeTransition: false, requiresExplicitConfirmation: true, reviewStatus: 'PENDING_REVIEW' };
  }

  if (category === 'DELIVERY_FAILURE' && confidenceBand === 'HIGH') {
    return { confidenceBand, shouldProposeTransition: true, requiresExplicitConfirmation: false, reviewStatus: 'AUTO_ACCEPTED' };
  }

  if (HIGH_IMPACT_CATEGORIES.has(category)) {
    // Always requires explicit confirmation, regardless of confidence band (Phase 12: "irreversible
    // or high-impact outcomes always require explicit confirmation").
    return { confidenceBand, shouldProposeTransition: true, requiresExplicitConfirmation: true, reviewStatus: 'PENDING_REVIEW' };
  }

  if (confidenceBand === 'HIGH') {
    // "Show classification immediately, propose lifecycle transition, notify user — never
    // auto-send a reply" — still requires the user to confirm the *lifecycle transition* itself;
    // HIGH confidence changes what gets shown/proposed, never what gets silently applied.
    return { confidenceBand, shouldProposeTransition: true, requiresExplicitConfirmation: true, reviewStatus: 'PENDING_REVIEW' };
  }

  // MEDIUM, non-high-impact.
  return { confidenceBand, shouldProposeTransition: true, requiresExplicitConfirmation: true, reviewStatus: 'PENDING_REVIEW' };
}
