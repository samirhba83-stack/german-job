import { CampaignStatus } from '@german-job-engine/shared-types';
import { CanTransitionSpecification } from './can-transition.specification';

const S = CampaignStatus;

describe('CanTransitionSpecification', () => {
  it('allows DRAFT to move to READY, CANCELLED, or ARCHIVED', () => {
    expect(CanTransitionSpecification.isSatisfiedBy(S.DRAFT, S.READY)).toBe(true);
    expect(CanTransitionSpecification.isSatisfiedBy(S.DRAFT, S.CANCELLED)).toBe(true);
    expect(CanTransitionSpecification.isSatisfiedBy(S.DRAFT, S.ARCHIVED)).toBe(true);
  });

  it('refuses DRAFT to jump straight to RUNNING', () => {
    expect(CanTransitionSpecification.isSatisfiedBy(S.DRAFT, S.RUNNING)).toBe(false);
  });

  it('allows STOPPED to resume, unlike CANCELLED or COMPLETED', () => {
    expect(CanTransitionSpecification.isSatisfiedBy(S.STOPPED, S.RESUMING)).toBe(true);
    expect(CanTransitionSpecification.isSatisfiedBy(S.CANCELLED, S.RESUMING)).toBe(false);
    expect(CanTransitionSpecification.isSatisfiedBy(S.COMPLETED, S.RESUMING)).toBe(false);
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
