import { ActorRole } from '@german-job-engine/shared-types';
import { ApplicationPolicy, PolicyDecision, allow, deny } from './application-policy.interface';
import { Actor } from '../value-objects/actor.vo';
import { IsOwnedBySpecification } from '../specifications/is-owned-by.specification';
import { IsCompanyOwnerSpecification } from '../specifications/is-company-owner.specification';

/**
 * Governs -> ARCHIVED. M31.1 — replaces an earlier, trivially-permissive version of this policy
 * (`authorize(): PolicyDecision { return allow(...); }`, "Deliberately permissive by design")
 * that conflated "archiving is a low-consequence, likely-reversible action" with "no ownership
 * check is acceptable." The two are different questions; this version answers the second one for
 * real, the same way `ReadinessPolicy`/`WithdrawalPolicy` already do for their own transitions:
 *
 * - Candidate: only the owning candidate (`IsOwnedBySpecification`).
 * - Company: only the employer user who owns the company this application belongs to
 *   (`IsCompanyOwnerSpecification`, `companyOwnerId` pre-resolved by the handler).
 * - Admin: always allowed, but must supply a reason (`hasReason`) — the real, durable audit trail
 *   is `Application`'s own `Timeline` (every `applyTransition()` call appends a `TimelineEntry`
 *   carrying `actor`+`reason`; nothing new needed for "immutable audit event" beyond making the
 *   reason actually required here).
 * - System: allowed (internal workflows only — never reachable via the public HTTP API, since
 *   `toActorRole()` in the controller can only ever produce CANDIDATE/COMPANY/ADMIN from a real JWT).
 *
 * This is checked from `Application.archive()` itself (the authoritative domain boundary) — not
 * only from the handler-level `assertCanAccessApplication()` pre-check that already existed
 * (`archive-application.handler.ts`, kept as a fast, defense-in-depth first line). A caller that
 * invokes `application.archive()` directly, bypassing that handler, cannot bypass authorization —
 * the domain aggregate enforces its own rule regardless of which caller reaches it.
 */
export class ArchivalPolicy implements ApplicationPolicy {
  readonly name = 'ArchivalPolicy';

  authorize(context: { actor: Actor; candidateId: string; companyOwnerId: string | null; hasReason: boolean }): PolicyDecision {
    if (context.actor.role === ActorRole.ADMIN) {
      if (!context.hasReason) {
        return deny('ARCHIVAL_REQUIRES_ADMIN_REASON', 'An admin archiving an application must supply a reason.');
      }
      return allow('ARCHIVAL_OK', 'Archival accepted (admin, reason recorded).');
    }

    if (context.actor.role === ActorRole.SYSTEM) {
      return allow('ARCHIVAL_OK', 'Archival accepted (system).');
    }

    if (IsOwnedBySpecification.isSatisfiedBy(context.actor, context.candidateId)) {
      return allow('ARCHIVAL_OK', 'Archival accepted (owning candidate).');
    }

    if (IsCompanyOwnerSpecification.isSatisfiedBy(context.actor, context.companyOwnerId)) {
      return allow('ARCHIVAL_OK', 'Archival accepted (owning company).');
    }

    return deny(
      'ARCHIVAL_REQUIRES_OWNER_OR_ADMIN',
      'Only the owning candidate, the owning company, or an Admin may archive this application.',
    );
  }
}
