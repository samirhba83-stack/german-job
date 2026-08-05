import { ApplicationLifecycleStatus } from '@german-job-engine/shared-types';

const TERMINAL_STATES: ReadonlyArray<ApplicationLifecycleStatus> = [
  ApplicationLifecycleStatus.CONTRACT_SIGNED,
  ApplicationLifecycleStatus.REJECTED,
  ApplicationLifecycleStatus.WITHDRAWN,
  ApplicationLifecycleStatus.ARCHIVED,
];

/**
 * "No Timeline activity for N days while in an active, non-terminal state." Defined now as an
 * extension point for a future auto-archival job — nothing invokes it yet.
 */
export class IsStaleApplicationSpecification {
  static isSatisfiedBy(
    status: ApplicationLifecycleStatus,
    lastActivityAt: Date,
    staleAfterDays: number,
    referenceDate: Date = new Date(),
  ): boolean {
    if (TERMINAL_STATES.includes(status)) {
      return false;
    }

    const elapsedMs = referenceDate.getTime() - lastActivityAt.getTime();
    const staleThresholdMs = staleAfterDays * 24 * 60 * 60 * 1000;
    return elapsedMs >= staleThresholdMs;
  }
}
