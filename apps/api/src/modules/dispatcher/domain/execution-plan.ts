import { ExecutionWindow } from '../../campaigns/domain/value-objects/execution-window.vo';

export type ExecutionAction = 'DISPATCH_NOW' | 'DELAY';

/** One transparent, named factor behind an ExecutionPlan — the Dispatcher's observability trail. */
export interface ExecutionDecisionFactor {
  readonly factor: string;
  readonly reasonCode: string;
  readonly explanation: string;
}

/**
 * The Dispatcher's full, explainable execution recommendation for a single campaign. Every
 * field is advisory data — CampaignDispatcherService never dispatches anything, so nothing here
 * is enforced. A future Worker milestone decides whether and how to act on it.
 */
export interface ExecutionPlan {
  readonly campaignId: string;
  readonly recommendedAction: ExecutionAction;
  readonly executionPriority: number;
  readonly recommendedBatchSize: number;
  readonly delayBetweenEmailsMs: number;
  readonly cooldownAfterBatchMs: number;
  readonly recommendedExecutionWindow: ExecutionWindow;
  /** Earliest instant execution is not blocked by a hard risk/quota gate. */
  readonly earliestExecutionAt: Date;
  /**
   * Intelligent-timing suggestion — never earlier than `earliestExecutionAt`, but may be later
   * (e.g. nudged to the next business morning). Purely advisory: a caller is free to act on
   * `earliestExecutionAt` instead and ignore this field entirely.
   */
  readonly recommendedExecutionAt: Date;
  readonly riskScore: number;
  readonly deliveryConfidenceScore: number;
  readonly decisionLog: ReadonlyArray<ExecutionDecisionFactor>;
}
