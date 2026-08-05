import { DecisionReport } from '../../decision-intelligence/domain/decision-report';

export type ExecutionStepType = 'PREPARATION' | 'BATCH_EXECUTION' | 'HEALTH_CHECKPOINT' | 'COOLDOWN' | 'COMPLETION';

/**
 * One node in the execution process — never "send email to X", always a process-level step
 * (prepare, execute a batch, check health, cool down, complete). The Execution Planning Engine
 * has no target/company/candidate data (it consumes DecisionReports only), so steps describe
 * HOW the decision will be carried out procedurally, not WHAT will literally be sent.
 */
export interface ExecutionStep {
  readonly id: string;
  readonly type: ExecutionStepType;
  readonly phase: number;
  readonly title: string;
  readonly explanation: string;
  /** Step ids that must complete before this step may start. */
  readonly dependsOn: ReadonlyArray<string>;
}

export interface ExecutionPhase {
  readonly index: number;
  readonly name: string;
  readonly stepIds: ReadonlyArray<string>;
}

export interface BatchScheduleEntry {
  readonly batchNumber: number;
  readonly stepId: string;
  /** Milliseconds after plan start (relative, not an absolute Date — see module doc comment). */
  readonly relativeStartOffsetMs: number;
}

export interface BatchSchedule {
  readonly batchCount: number;
  readonly entries: ReadonlyArray<BatchScheduleEntry>;
}

/** An abstract, calendar-independent execution window — "phase N may run between these two
 * relative offsets" — not the Campaigns module's weekday/hour ExecutionWindow, which requires
 * campaign data this engine deliberately does not have access to. */
export interface ExecutionWindowPlan {
  readonly windowIndex: number;
  readonly relativeStartMs: number;
  readonly relativeEndMs: number;
}

export interface RetryScheduleEntry {
  readonly stepId: string;
  readonly maxAttempts: number;
  /** One backoff delay per retry attempt, in order. */
  readonly backoffMs: ReadonlyArray<number>;
}

export interface RetryPlan {
  readonly entries: ReadonlyArray<RetryScheduleEntry>;
}

export interface PacingStrategy {
  readonly interBatchDelayMs: number;
  readonly interStepDelayMs: number;
}

export interface CooldownPlanEntry {
  readonly stepId: string;
  readonly durationMs: number;
  readonly reason: string;
}

export interface CooldownPlan {
  readonly entries: ReadonlyArray<CooldownPlanEntry>;
}

export interface DependencyEdge {
  readonly fromStepId: string;
  readonly toStepId: string;
}

export interface DependencyGraph {
  readonly edges: ReadonlyArray<DependencyEdge>;
}

/**
 * The Execution Planning Engine's output (Phase 4 M7) — one deterministic, reproducible plan per
 * campaign, transformed purely from a DecisionReport. Advisory only: nothing about an
 * ExecutionBlueprint sends anything, creates any job, or touches any queue/worker/provider.
 * Named distinctly from the Dispatcher's (M4) `ExecutionPlan` — that is a single risk/batch-size/
 * timing recommendation for a campaign; this is the full procedural breakdown of how a decision
 * gets carried out. `basedOn` carries the complete source DecisionReport (which itself carries
 * every recommendation considered) so a blueprint is traceable back to its origin without any
 * external lookup.
 */
export interface ExecutionBlueprint {
  readonly campaignId: string;
  readonly steps: ReadonlyArray<ExecutionStep>;
  readonly phases: ReadonlyArray<ExecutionPhase>;
  readonly batchSchedule: BatchSchedule;
  readonly executionWindows: ReadonlyArray<ExecutionWindowPlan>;
  readonly retryPlan: RetryPlan;
  readonly pacingStrategy: PacingStrategy;
  readonly cooldownPlan: CooldownPlan;
  readonly dependencyGraph: DependencyGraph;
  readonly explanation: string;
  readonly basedOn: DecisionReport;
}
