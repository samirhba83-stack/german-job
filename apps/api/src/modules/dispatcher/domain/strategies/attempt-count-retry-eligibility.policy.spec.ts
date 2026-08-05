import { DispatchOutcome } from '@german-job-engine/shared-types';
import { AttemptCountRetryEligibilityPolicy } from './attempt-count-retry-eligibility.policy';
import { CampaignTarget } from '../../../campaigns/domain/entities/campaign-target.entity';
import { DispatchAttempt } from '../../../campaigns/domain/entities/dispatch-attempt.entity';

const NOW = new Date('2026-01-05T12:00:00.000Z');

function targetWithAttempts(count: number): CampaignTarget {
  const target = CampaignTarget.create('target-1', 'job-1', 'company-1');
  for (let i = 0; i < count; i += 1) {
    target.recordFailedAttempt(
      DispatchAttempt.create(`attempt-${i}`, {
        attemptNumber: i + 1,
        attemptedAt: NOW,
        outcome: DispatchOutcome.FAILED,
        failureReason: 'smtp timeout',
        evidenceReference: null,
      }),
    );
  }
  return target;
}

describe('AttemptCountRetryEligibilityPolicy', () => {
  const policy = new AttemptCountRetryEligibilityPolicy();

  it('allows a retry while below the default max attempt count', () => {
    const decision = policy.evaluate(targetWithAttempts(2), NOW);

    expect(decision.allowed).toBe(true);
  });

  it('denies once the default max attempt count is reached', () => {
    const decision = policy.evaluate(targetWithAttempts(3), NOW);

    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe('MAX_ATTEMPTS_REACHED');
  });
});
