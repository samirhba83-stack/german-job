import { ApplicationPolicy, PolicyDecision, allow } from './application-policy.interface';

/** Governs interview scheduling and completion. Company, Candidate (mutual confirmation), and
 * System (calendar integration) may all legitimately trigger these — no actor restriction. */
export class InterviewPolicy implements ApplicationPolicy {
  readonly name = 'InterviewPolicy';

  authorize(): PolicyDecision {
    return allow('INTERVIEW_OK', 'No additional authorization required for interview scheduling/completion.');
  }
}
