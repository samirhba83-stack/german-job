import { ApplicationLifecycleStatus } from '@german-job-engine/shared-types';
import { CanTransitionSpecification } from './can-transition.specification';

const S = ApplicationLifecycleStatus;

describe('CanTransitionSpecification', () => {
  it('allows DRAFT to move to PREPARED, WITHDRAWN, or ARCHIVED', () => {
    expect(CanTransitionSpecification.isSatisfiedBy(S.DRAFT, S.PREPARED)).toBe(true);
    expect(CanTransitionSpecification.isSatisfiedBy(S.DRAFT, S.WITHDRAWN)).toBe(true);
    expect(CanTransitionSpecification.isSatisfiedBy(S.DRAFT, S.ARCHIVED)).toBe(true);
  });

  it('refuses DRAFT to jump straight to SENT', () => {
    expect(CanTransitionSpecification.isSatisfiedBy(S.DRAFT, S.SENT)).toBe(false);
  });

  it('allows OFFER_RECEIVED from both COMPANY_REPLIED (fast-track) and INTERVIEW_COMPLETED', () => {
    expect(CanTransitionSpecification.isSatisfiedBy(S.COMPANY_REPLIED, S.OFFER_RECEIVED)).toBe(true);
    expect(CanTransitionSpecification.isSatisfiedBy(S.INTERVIEW_COMPLETED, S.OFFER_RECEIVED)).toBe(true);
  });

  it('treats ARCHIVED as a true terminal state with no outgoing transitions', () => {
    expect(CanTransitionSpecification.allowedTargets(S.ARCHIVED)).toEqual([]);
  });

  it('allows every non-ARCHIVED state to reach ARCHIVED', () => {
    const nonArchivedStates = Object.values(S).filter((status) => status !== S.ARCHIVED);
    for (const status of nonArchivedStates) {
      expect(CanTransitionSpecification.isSatisfiedBy(status, S.ARCHIVED)).toBe(true);
    }
  });
});
