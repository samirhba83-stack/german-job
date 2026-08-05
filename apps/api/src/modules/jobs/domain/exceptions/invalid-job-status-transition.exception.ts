import { JobStatus } from '@german-job-engine/shared-types';

export class InvalidJobStatusTransitionException extends Error {
  constructor(from: JobStatus, action: string) {
    super(`Cannot ${action} a job currently in status: ${from}`);
    this.name = 'InvalidJobStatusTransitionException';
  }
}
