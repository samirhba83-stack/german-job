import { ApplicationLifecycleStatus } from '@german-job-engine/shared-types';

const { DRAFT, PREPARED, QUEUED, SENT, DELIVERED, OPENED, VIEWED, COMPANY_REPLIED, INTERVIEW_SCHEDULED, INTERVIEW_COMPLETED, OFFER_RECEIVED, CONTRACT_SIGNED, REJECTED, WITHDRAWN, ARCHIVED } = ApplicationLifecycleStatus;

/**
 * The full lifecycle graph as a declarative lookup table, extracted from the aggregate so it is
 * independently unit-testable without constructing a full Application. Every entity transition
 * method consults this before applying any other precondition.
 */
const TRANSITION_GRAPH: Record<ApplicationLifecycleStatus, ReadonlyArray<ApplicationLifecycleStatus>> = {
  [DRAFT]: [PREPARED, WITHDRAWN, ARCHIVED],
  [PREPARED]: [QUEUED, WITHDRAWN, ARCHIVED],
  [QUEUED]: [SENT, WITHDRAWN, ARCHIVED],
  [SENT]: [DELIVERED, COMPANY_REPLIED, REJECTED, WITHDRAWN, ARCHIVED],
  [DELIVERED]: [OPENED, COMPANY_REPLIED, REJECTED, WITHDRAWN, ARCHIVED],
  [OPENED]: [VIEWED, COMPANY_REPLIED, REJECTED, WITHDRAWN, ARCHIVED],
  [VIEWED]: [COMPANY_REPLIED, REJECTED, WITHDRAWN, ARCHIVED],
  [COMPANY_REPLIED]: [INTERVIEW_SCHEDULED, OFFER_RECEIVED, REJECTED, WITHDRAWN, ARCHIVED],
  [INTERVIEW_SCHEDULED]: [INTERVIEW_COMPLETED, REJECTED, WITHDRAWN, ARCHIVED],
  [INTERVIEW_COMPLETED]: [OFFER_RECEIVED, REJECTED, WITHDRAWN, ARCHIVED],
  [OFFER_RECEIVED]: [CONTRACT_SIGNED, WITHDRAWN, ARCHIVED],
  [CONTRACT_SIGNED]: [ARCHIVED],
  [REJECTED]: [ARCHIVED],
  [WITHDRAWN]: [ARCHIVED],
  [ARCHIVED]: [],
};

export class CanTransitionSpecification {
  static isSatisfiedBy(from: ApplicationLifecycleStatus, to: ApplicationLifecycleStatus): boolean {
    return TRANSITION_GRAPH[from].includes(to);
  }

  static allowedTargets(from: ApplicationLifecycleStatus): ReadonlyArray<ApplicationLifecycleStatus> {
    return TRANSITION_GRAPH[from];
  }
}
