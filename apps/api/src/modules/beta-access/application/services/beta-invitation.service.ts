import { randomBytes } from 'node:crypto';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExecutionClock, EXECUTION_CLOCK } from '../../../execution/domain/ports/execution-clock.port';
import { EmailSecurityAuditService } from '../../../documents/application/services/email-security-audit.service';
import { BetaInvitationRepository, BETA_INVITATION_REPOSITORY } from '../../domain/ports/beta-invitation.repository';
import { BetaInvitationRecord, BetaInvitationStatus } from '../../domain/models/beta-invitation';

export interface RedeemResult {
  readonly ok: boolean;
  readonly invitation: BetaInvitationRecord | null;
  readonly reason: 'NOT_FOUND' | 'EMAIL_MISMATCH' | 'EXPIRED' | 'ALREADY_HANDLED' | 'RACE_LOST' | null;
}

/**
 * M31 Phase 20 — the one authoritative writer of `BetaInvitation`. `redeem()` is the real gate
 * `RegisterHandler` calls through — never a raw repository call from the auth module, matching
 * this codebase's own established "one authoritative application service per aggregate, never a
 * direct repository call from an unrelated module" discipline (M30's `FollowUpControlService` is
 * the most recent precedent this follows).
 */
@Injectable()
export class BetaInvitationService {
  constructor(
    @Inject(BETA_INVITATION_REPOSITORY) private readonly invitations: BetaInvitationRepository,
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
    private readonly config: ConfigService,
    private readonly audit: EmailSecurityAuditService,
  ) {}

  async invite(email: string, invitedByAdminId: string): Promise<BetaInvitationRecord> {
    const now = this.clock.now();
    const expiryDays = this.config.get<number>('betaAccess.invitationExpiryDays', 14);
    const expiresAt = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);
    // A cryptographically random code, URL-safe, long enough that guessing is infeasible — never
    // a sequential id or anything derived from the email itself.
    const code = randomBytes(24).toString('base64url');

    const created = await this.invitations.create({ email: email.toLowerCase(), code, invitedByAdminId, expiresAt }, now);
    await this.audit.record({ eventType: 'BETA_INVITATION_CREATED', userId: invitedByAdminId, detail: `Invited ${email}, expires ${expiresAt.toISOString()}` });
    return created;
  }

  async revoke(id: string, revokedByAdminId: string, reason: string): Promise<BetaInvitationRecord> {
    const now = this.clock.now();
    const invitation = await this.invitations.findById(id);
    if (!invitation) {
      throw new NotFoundException('Invitation not found.');
    }
    if (invitation.status !== 'PENDING') {
      throw new ConflictException('Only a pending invitation can be revoked.');
    }
    const revoked = await this.invitations.revoke(id, revokedByAdminId, reason, now);
    await this.audit.record({ eventType: 'BETA_INVITATION_REVOKED', userId: revokedByAdminId, detail: `Revoked invitation for ${invitation.email}: ${reason}` });
    return revoked;
  }

  /** The real registration gate — called from `RegisterHandler` whenever
   * `betaAccess.publicRegistrationEnabled` is `false` (the default, and the state this milestone's
   * own instruction requires stays the default). Real-time expiry is checked here (not only via a
   * separate cleanup job) — the same "the evaluator itself resolves expiry" discipline M30's
   * `evaluateFollowUpEligibility()` established, so a real invitation that's aged past its
   * `expiresAt` is correctly refused even if no cleanup tick has run yet. */
  async checkEligible(email: string, code: string): Promise<{ eligible: boolean; reason?: string }> {
    const invitation = await this.invitations.findByCode(code);
    if (!invitation) return { eligible: false, reason: 'Invalid invitation code.' };
    if (invitation.email.toLowerCase() !== email.toLowerCase()) return { eligible: false, reason: 'This invitation was issued for a different email address.' };
    if (invitation.status !== 'PENDING') return { eligible: false, reason: 'This invitation has already been used or revoked.' };
    if (invitation.expiresAt.getTime() <= this.clock.now().getTime()) return { eligible: false, reason: 'This invitation has expired.' };
    return { eligible: true };
  }

  /** Atomically consumes the invitation as part of a real registration — called ONLY after the
   * new user account itself has been created (so `usedByUserId` references a real, already-
   * persisted user), matching `checkEligible()`'s own real-time checks re-verified here against
   * the exactly-once conditional claim (closing the same TOCTOU gap M30's own
   * `ApplicationTransitionProposalRepository.tryTransition()` closed — two concurrent registration
   * attempts for the same invitation code must never both succeed). */
  async redeem(email: string, code: string, newUserId: string): Promise<RedeemResult> {
    const now = this.clock.now();
    const invitation = await this.invitations.findByCode(code);
    if (!invitation) return { ok: false, invitation: null, reason: 'NOT_FOUND' };
    if (invitation.email.toLowerCase() !== email.toLowerCase()) return { ok: false, invitation, reason: 'EMAIL_MISMATCH' };
    if (invitation.expiresAt.getTime() <= now.getTime()) return { ok: false, invitation, reason: 'EXPIRED' };
    if (invitation.status !== 'PENDING') return { ok: false, invitation, reason: 'ALREADY_HANDLED' };

    const claimed = await this.invitations.tryConsume(invitation.id, newUserId, now);
    if (!claimed) return { ok: false, invitation, reason: 'RACE_LOST' };

    await this.audit.record({ eventType: 'BETA_INVITATION_REDEEMED', userId: newUserId, detail: `Redeemed invitation ${invitation.id} for ${email}` });
    return { ok: true, invitation: claimed, reason: null };
  }

  async list(status: BetaInvitationStatus | undefined, limit: number, offset: number): Promise<BetaInvitationRecord[]> {
    return this.invitations.list(status, limit, offset);
  }
}
