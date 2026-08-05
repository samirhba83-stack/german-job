import { ApplicationLifecycleStatus } from '@german-job-engine/shared-types';

export class InvalidApplicationStatusTransitionException extends Error {
  constructor(from: ApplicationLifecycleStatus, to: ApplicationLifecycleStatus) {
    super(`Cannot transition an application from ${from} to ${to}`);
    this.name = 'InvalidApplicationStatusTransitionException';
  }
}
