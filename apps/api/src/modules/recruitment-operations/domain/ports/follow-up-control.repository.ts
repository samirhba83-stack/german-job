import { FollowUpControlRecord, CreateFollowUpControlInput, FollowUpControlStatus } from '../models/follow-up-control';

export const FOLLOW_UP_CONTROL_REPOSITORY = Symbol('FOLLOW_UP_CONTROL_REPOSITORY');

export interface FollowUpControlRepository {
  findById(id: string): Promise<FollowUpControlRecord | null>;

  /** The one real query `FollowUpEligibilityService` and the pre-dispatch gate both use — the
   * partial unique index (`applicationId` WHERE status='ACTIVE') guarantees at most one result. */
  findActiveByApplicationId(applicationId: string): Promise<FollowUpControlRecord | null>;

  findByIdempotencyKey(idempotencyKey: string): Promise<FollowUpControlRecord | null>;

  /** Real, atomic "supersede-then-create": marks any existing ACTIVE control for this
   * `applicationId` as SUPERSEDED, then creates the new one as ACTIVE, inside one transaction —
   * the real backstop against a genuine concurrent race is still the partial unique index (a
   * losing concurrent writer's insert fails with P2002, which the caller re-fetches against). */
  createSuperseding(input: CreateFollowUpControlInput, now: Date): Promise<FollowUpControlRecord>;

  release(id: string, releasedBy: string, releaseReason: string, now: Date): Promise<FollowUpControlRecord>;

  markExpired(id: string, now: Date): Promise<FollowUpControlRecord>;

  markStatus(id: string, status: FollowUpControlStatus, now: Date): Promise<FollowUpControlRecord>;

  /** Every control whose `expiresAt` has passed and is still ACTIVE — the resume-tick driver's
   * one real query (Phase 10). */
  listExpiredActive(now: Date, limit: number): Promise<FollowUpControlRecord[]>;

  listByUserId(userId: string, status: FollowUpControlStatus | undefined, limit: number, offset: number): Promise<FollowUpControlRecord[]>;

  /** Admin visibility (Phase 17) — every active hold/suppression across all users. */
  listActive(limit: number, offset: number): Promise<FollowUpControlRecord[]>;
}
