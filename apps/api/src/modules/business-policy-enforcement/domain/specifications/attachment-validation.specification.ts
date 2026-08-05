import { PolicySpecification } from '../ports/policy-specification.port';
import { PolicyEvaluationContext } from '../models/policy-evaluation-context';
import { PolicyCheckResult } from '../models/policy-check-result';

export const ATTACHMENT_VALIDATION_POLICY = Symbol('ATTACHMENT_VALIDATION_POLICY');

export class AttachmentValidationSpecification implements PolicySpecification {
  readonly policyId = 'ATTACHMENT_VALIDATION';
  readonly policyName = 'Attachment Validation';

  isSatisfiedBy(context: PolicyEvaluationContext): PolicyCheckResult {
    const { attachments } = context;
    if (attachments.totalSizeBytes <= attachments.maxAllowedSizeBytes) {
      return { satisfied: true, reasonCode: 'ATTACHMENTS_VALID', explanation: `Attachment size ${attachments.totalSizeBytes} bytes is within the ${attachments.maxAllowedSizeBytes} byte limit.` };
    }
    return {
      satisfied: false,
      reasonCode: 'ATTACHMENT_SIZE_EXCEEDED',
      explanation: `Total attachment size ${attachments.totalSizeBytes} bytes exceeds the ${attachments.maxAllowedSizeBytes} byte limit.`,
    };
  }
}
