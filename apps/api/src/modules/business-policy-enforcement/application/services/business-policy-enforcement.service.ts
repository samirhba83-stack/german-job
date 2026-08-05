import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { EXECUTION_CLOCK, ExecutionClock } from '../../../execution/domain/ports/execution-clock.port';
import { POLICY_ENFORCEMENT_STRATEGY, PolicyEnforcementStrategy } from '../../domain/ports/policy-enforcement-strategy.port';
import { POLICY_SPECIFICATIONS, PolicySpecification } from '../../domain/ports/policy-specification.port';
import { PolicyEvaluationContext } from '../../domain/models/policy-evaluation-context';
import { PolicyDecision } from '../../domain/models/policy-decision';
import { ExecutionEventRecorder, EXECUTION_EVENT_RECORDER } from '../../../execution-tracking/domain/ports/execution-event-recorder.port';
import { EMPTY_BUSINESS_CONTEXT } from '../../../execution-tracking/domain/models/business-context';

/**
 * The single authority for enforcing business rules before any execution
 * proceeds (M15). Thin by design — it holds no repository, provider, or
 * queue dependency of any kind; it only composes the injected policies and
 * delegates the combination judgment to the injected strategy. Never sends
 * emails, calls providers, or mutates data. evaluate() became async in M16
 * solely to await recording its own decision — the decision logic itself
 * remains entirely synchronous inside the injected strategy.
 */
@Injectable()
export class BusinessPolicyEnforcementService {
  constructor(
    @Inject(POLICY_SPECIFICATIONS) private readonly policies: PolicySpecification[],
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
    @Inject(POLICY_ENFORCEMENT_STRATEGY) private readonly strategy: PolicyEnforcementStrategy,
    @Inject(EXECUTION_EVENT_RECORDER) private readonly eventRecorder: ExecutionEventRecorder,
  ) {}

  async evaluate(context: PolicyEvaluationContext): Promise<PolicyDecision> {
    const decision = this.strategy.evaluate(this.policies, context, this.clock.now());

    // M18: this module isn't wired into the main correlated pipeline yet — correlationId comes
    // from the caller when supplied, otherwise this evaluation starts its own (documented gap).
    const correlationId = context.correlationId ?? randomUUID();
    const policyEvaluationId = randomUUID();

    await this.eventRecorder.record({
      eventType: 'POLICY_EVALUATED',
      campaignId: null,
      executionId: decision.executionId,
      correlationId,
      traceId: decision.executionId,
      summary: decision.allowed ? 'Execution allowed' : 'Execution denied',
      explanation: decision.decisionReasoning,
      status: decision.allowed ? 'SUCCESS' : 'FAILURE',
      metadata: { evaluatedPolicyCount: String(decision.evaluatedPolicies.length), failedPolicyCount: String(decision.failedPolicies.length) },
      businessContext: { ...EMPTY_BUSINESS_CONTEXT, policyEvaluationId },
    });

    return decision;
  }
}
