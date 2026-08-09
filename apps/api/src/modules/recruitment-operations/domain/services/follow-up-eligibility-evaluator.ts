import { FollowUpControlRecord, FollowUpEligibilityResult } from '../models/follow-up-control';

/**
 * M30 Phase 4 — the pure decision core of `FollowUpEligibilityService`. Never touches a
 * repository itself (the caller resolves the current active control first) — fully
 * unit-testable in isolation, matching every other pure policy in this codebase.
 * `activeControl: null` (no active row at all) is the only path to `ELIGIBLE`.
 */
export function evaluateFollowUpEligibility(activeControl: FollowUpControlRecord | null, now: Date): FollowUpEligibilityResult {
  if (!activeControl) {
    return { status: 'ELIGIBLE', reasonCode: 'NO_ACTIVE_CONTROL', explanation: 'No active follow-up control exists for this application.', activeControl: null };
  }

  // A control whose expiry has already passed is treated as no-longer-blocking here — the real
  // status transition to EXPIRED happens via `FollowUpResumeService`'s own tick (Phase 10), but
  // this check must never let a stale-but-still-ACTIVE row block a legitimate resume attempt that
  // arrives before the tick catches up (Phase 4: "the final pre-send recheck is mandatory").
  if (activeControl.expiresAt && activeControl.expiresAt.getTime() <= now.getTime()) {
    return {
      status: 'ELIGIBLE',
      reasonCode: 'HOLD_EXPIRED',
      explanation: `The active ${activeControl.controlType} hold expired at ${activeControl.expiresAt.toISOString()} and is eligible for resume.`,
      activeControl,
    };
  }

  switch (activeControl.controlType) {
    case 'PERMANENT_SUPPRESSION':
      return {
        status: 'PERMANENTLY_BLOCKED',
        reasonCode: activeControl.reasonCode,
        explanation: activeControl.explanation,
        activeControl,
      };
    case 'MANUAL_REVIEW_HOLD':
      return { status: 'MANUAL_REVIEW_REQUIRED', reasonCode: activeControl.reasonCode, explanation: activeControl.explanation, activeControl };
    case 'DELIVERABILITY_BLOCK':
      // Recipient-scoped, not an employment-outcome signal — still a real block on further send
      // attempts to this same target, per the deliverability policy this mirrors.
      return { status: 'PERMANENTLY_BLOCKED', reasonCode: activeControl.reasonCode, explanation: activeControl.explanation, activeControl };
    case 'TEMPORARY_HOLD':
    case 'WAITING_PERIOD':
      return { status: 'TEMPORARILY_BLOCKED', reasonCode: activeControl.reasonCode, explanation: activeControl.explanation, activeControl };
  }
}
