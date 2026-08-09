import { BetaInvitationRecord, BetaInvitationStatus, CreateBetaInvitationInput } from '../models/beta-invitation';

export const BETA_INVITATION_REPOSITORY = Symbol('BETA_INVITATION_REPOSITORY');

export interface BetaInvitationRepository {
  create(input: CreateBetaInvitationInput, now: Date): Promise<BetaInvitationRecord>;
  findById(id: string): Promise<BetaInvitationRecord | null>;
  findByCode(code: string): Promise<BetaInvitationRecord | null>;
  /** The real, atomic, exactly-once consume — a conditional `updateMany` (same idiom this
   * codebase already proved race-safe for email-queue claims and M30's transition-proposal
   * confirmation) guarding against two concurrent registration attempts both consuming the same
   * invitation. Returns `null` if the invitation was no longer `PENDING` at the moment of the
   * attempt (lost a race, already used, or already revoked/expired). */
  tryConsume(id: string, usedByUserId: string, now: Date): Promise<BetaInvitationRecord | null>;
  revoke(id: string, revokedByAdminId: string, reason: string, now: Date): Promise<BetaInvitationRecord>;
  list(status: BetaInvitationStatus | undefined, limit: number, offset: number): Promise<BetaInvitationRecord[]>;
}
