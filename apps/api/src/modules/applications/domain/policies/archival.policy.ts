import { ApplicationPolicy, PolicyDecision, allow } from './application-policy.interface';

/** Governs -> ARCHIVED. Deliberately permissive by design, matching the Job/Company archive()
 * precedent — Candidate, Company, Admin, or System may all archive an application. */
export class ArchivalPolicy implements ApplicationPolicy {
  readonly name = 'ArchivalPolicy';

  authorize(): PolicyDecision {
    return allow('ARCHIVAL_OK', 'Archival accepted.');
  }
}
