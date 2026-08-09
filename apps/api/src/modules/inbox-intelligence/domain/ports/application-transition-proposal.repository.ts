import { ApplicationTransitionProposalRecord, CreateApplicationTransitionProposalInput } from '../models/application-transition-proposal';

export const APPLICATION_TRANSITION_PROPOSAL_REPOSITORY = Symbol('APPLICATION_TRANSITION_PROPOSAL_REPOSITORY');

export interface ApplicationTransitionProposalRepository {
  findById(id: string): Promise<ApplicationTransitionProposalRecord | null>;
  create(input: CreateApplicationTransitionProposalInput, now: Date): Promise<ApplicationTransitionProposalRecord>;

  /**
   * M30 Phase 7 concurrency fix — atomic, status-guarded transition: `UPDATE ... WHERE id = ? AND
   * status = ?fromStatus`, the same `updateMany` + affected-row-count idiom
   * `PrismaEmailQueueRepository.claimBatch()` already uses to claim a row exactly once under real
   * concurrency. Returns `null` when the row was no longer in `fromStatus` at the moment of the
   * attempt (lost a race, or already handled by another request) — the caller's real, DB-level
   * "exactly-once" guarantee, replacing what used to be a read-then-write check in the service
   * layer alone (a genuine TOCTOU gap: two concurrent confirm calls for the same proposal could
   * both pass a plain `status === 'PENDING'` read before either write landed).
   */
  tryTransition(id: string, fromStatus: 'PENDING' | 'CONFIRMED', toStatus: 'CONFIRMED' | 'REJECTED' | 'PENDING', actorUserId: string, now: Date): Promise<ApplicationTransitionProposalRecord | null>;

  listByApplicationId(applicationId: string): Promise<ApplicationTransitionProposalRecord[]>;
  listPending(limit: number, offset: number): Promise<ApplicationTransitionProposalRecord[]>;
}
