import { ApplicationTransitionProposalRecord, CreateApplicationTransitionProposalInput } from '../models/application-transition-proposal';

export const APPLICATION_TRANSITION_PROPOSAL_REPOSITORY = Symbol('APPLICATION_TRANSITION_PROPOSAL_REPOSITORY');

export interface ApplicationTransitionProposalRepository {
  findById(id: string): Promise<ApplicationTransitionProposalRecord | null>;
  create(input: CreateApplicationTransitionProposalInput, now: Date): Promise<ApplicationTransitionProposalRecord>;
  markConfirmed(id: string, confirmedByUserId: string, now: Date): Promise<ApplicationTransitionProposalRecord>;
  markRejected(id: string, rejectedByUserId: string, now: Date): Promise<ApplicationTransitionProposalRecord>;
  listByApplicationId(applicationId: string): Promise<ApplicationTransitionProposalRecord[]>;
  listPending(limit: number, offset: number): Promise<ApplicationTransitionProposalRecord[]>;
}
