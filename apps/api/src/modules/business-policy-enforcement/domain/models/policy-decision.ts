/**
 * Field mapping for the milestone's explainability requirements:
 * "violated policy" -> policyName, "policy identifier" -> policyId,
 * "rejection reason" and "machine-readable error code" -> reasonCode (one
 * stable enum-like string honestly serves both), "human-readable
 * explanation" -> explanation.
 */
export interface EvaluatedPolicy {
  readonly policyId: string;
  readonly policyName: string;
  readonly satisfied: boolean;
  readonly reasonCode: string;
  readonly explanation: string;
}

export interface FailedPolicy {
  readonly policyId: string;
  readonly policyName: string;
  readonly reasonCode: string;
  readonly explanation: string;
}

/** The engine's single immutable output. */
export interface PolicyDecision {
  readonly executionId: string;
  readonly allowed: boolean;
  readonly denied: boolean;
  readonly decisionTimestamp: Date;
  readonly evaluatedPolicies: ReadonlyArray<EvaluatedPolicy>;
  readonly failedPolicies: ReadonlyArray<FailedPolicy>;
  readonly explanations: ReadonlyArray<string>;
  readonly decisionReasoning: string;
}
