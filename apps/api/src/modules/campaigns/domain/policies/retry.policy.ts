import { PolicyDecision, allow, deny } from './campaign-policy.interface';

const DEFAULT_MAX_ATTEMPTS = 3;

/** Allows a retry only while attemptNumber < maxAttempts; beyond that, retries are exhausted. */
export class RetryPolicy {
  authorize(currentAttemptCount: number, maxAttempts: number = DEFAULT_MAX_ATTEMPTS): PolicyDecision {
    if (currentAttemptCount >= maxAttempts) {
      return deny('MAX_ATTEMPTS_REACHED', `Maximum retry attempts (${maxAttempts}) reached.`);
    }
    return allow();
  }
}
