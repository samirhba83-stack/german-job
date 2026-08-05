import { PolicyDecision, allow, deny } from './campaign-policy.interface';
import { IsWithinExecutionWindowSpecification } from '../specifications/is-within-execution-window.specification';
import { ExecutionWindow } from '../value-objects/execution-window.vo';

/** Real, enforced rule — refuses dispatch outside the campaign's allowed weekdays/hours. */
export class ExecutionWindowPolicy {
  authorize(window: ExecutionWindow, instant: Date): PolicyDecision {
    if (!IsWithinExecutionWindowSpecification.isSatisfiedBy(window, instant)) {
      return deny('OUTSIDE_EXECUTION_WINDOW', 'The current instant falls outside the campaign execution window.');
    }
    return allow();
  }
}
