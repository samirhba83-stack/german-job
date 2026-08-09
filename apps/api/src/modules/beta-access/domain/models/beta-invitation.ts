export type BetaInvitationStatus = 'PENDING' | 'USED' | 'REVOKED' | 'EXPIRED';

export interface BetaInvitationRecord {
  readonly id: string;
  readonly email: string;
  readonly code: string;
  readonly status: BetaInvitationStatus;
  readonly invitedByAdminId: string;
  readonly usedByUserId: string | null;
  readonly usedAt: Date | null;
  readonly revokedAt: Date | null;
  readonly revokedByAdminId: string | null;
  readonly revokedReason: string | null;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

export interface CreateBetaInvitationInput {
  readonly email: string;
  readonly code: string;
  readonly invitedByAdminId: string;
  readonly expiresAt: Date;
}
