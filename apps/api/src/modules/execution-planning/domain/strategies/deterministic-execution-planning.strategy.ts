import { Inject, Injectable } from '@nestjs/common';
import { RecommendationCategory } from '../../../recommendations/domain/recommendation';
import { DecisionReport } from '../../../decision-intelligence/domain/decision-report';
import {
  BatchSchedule,
  BatchScheduleEntry,
  CooldownPlan,
  DependencyEdge,
  DependencyGraph,
  ExecutionBlueprint,
  ExecutionPhase,
  ExecutionStep,
  ExecutionWindowPlan,
  PacingStrategy,
  RetryPlan,
} from '../execution-blueprint';
import { ExecutionPlanningStrategy } from '../ports/execution-planning-strategy.port';
import { ExecutionPlanningConfig, EXECUTION_PLANNING_CONFIG } from '../execution-planning-config';

const MINUTES_PER_MS = 1 / 60_000;

/**
 * Default EXECUTION_PLANNING_STRATEGY binding. Turns a DecisionReport's final recommendation
 * into a generic batch/checkpoint/cooldown process: PREPARATION -> N x [BATCH_EXECUTION ->
 * HEALTH_CHECKPOINT -> COOLDOWN] -> COMPLETION (the last batch skips its cooldown, going
 * straight to COMPLETION). Every number — batch count, cooldown duration, retry backoff, window
 * length — comes from injected config or is derived from the DecisionReport's own confidence/
 * category, never a bare literal in this class. Pure function: no clock, no randomness, no I/O —
 * the same DecisionReport always produces byte-identical output (step ids are deterministic
 * strings derived from index, and every timing field is a relative offset in milliseconds from
 * plan start, not an absolute Date).
 */
@Injectable()
export class DeterministicExecutionPlanningStrategy implements ExecutionPlanningStrategy {
  constructor(@Inject(EXECUTION_PLANNING_CONFIG) private readonly config: ExecutionPlanningConfig) {}

  plan(decisionReport: DecisionReport): ExecutionBlueprint {
    if (!decisionReport.finalRecommendation) {
      return this.emptyBlueprint(decisionReport);
    }

    const { category } = decisionReport.finalRecommendation;
    const batchCount = this.computeBatchCount(decisionReport.confidenceScore);
    const cooldownDurationMs = this.computeCooldownDuration(category);

    const steps = this.buildSteps(batchCount);
    const phases = this.buildPhases(steps);
    const batchSchedule = this.buildBatchSchedule(steps, cooldownDurationMs);
    const executionWindows = this.buildExecutionWindows(phases, batchSchedule);
    const retryPlan = this.buildRetryPlan(steps);
    const cooldownPlan = this.buildCooldownPlan(steps, cooldownDurationMs, category);
    const dependencyGraph = this.buildDependencyGraph(steps);
    const pacingStrategy: PacingStrategy = {
      interBatchDelayMs: this.config.interBatchDelayMs,
      interStepDelayMs: this.config.interStepDelayMs,
    };

    return {
      campaignId: decisionReport.campaignId,
      steps,
      phases,
      batchSchedule,
      executionWindows,
      retryPlan,
      pacingStrategy,
      cooldownPlan,
      dependencyGraph,
      explanation: this.buildExplanation(decisionReport, batchCount, cooldownDurationMs),
      basedOn: decisionReport,
    };
  }

  private emptyBlueprint(decisionReport: DecisionReport): ExecutionBlueprint {
    return {
      campaignId: decisionReport.campaignId,
      steps: [],
      phases: [],
      batchSchedule: { batchCount: 0, entries: [] },
      executionWindows: [],
      retryPlan: { entries: [] },
      pacingStrategy: { interBatchDelayMs: 0, interStepDelayMs: 0 },
      cooldownPlan: { entries: [] },
      dependencyGraph: { edges: [] },
      explanation: 'No execution planning required; the Decision Intelligence Engine recommended no action for this campaign.',
      basedOn: decisionReport,
    };
  }

  private computeBatchCount(confidenceScore: number): number {
    const extra = confidenceScore < this.config.lowConfidenceThreshold ? this.config.lowConfidenceExtraBatches : 0;
    return this.config.baseBatchCount + extra;
  }

  private computeCooldownDuration(category: RecommendationCategory): number {
    return category === 'RISK' ? this.config.cooldownDurationMs * this.config.cooldownRiskMultiplier : this.config.cooldownDurationMs;
  }

  private buildSteps(batchCount: number): ExecutionStep[] {
    const steps: ExecutionStep[] = [];
    const preparationId = 'step-preparation';

    steps.push({
      id: preparationId,
      type: 'PREPARATION',
      phase: 0,
      title: 'Prepare execution',
      explanation: 'Initial preparation before any batch executes.',
      dependsOn: [],
    });

    let previousStepId = preparationId;

    for (let batchNumber = 1; batchNumber <= batchCount; batchNumber += 1) {
      const batchStepId = `step-batch-${batchNumber}`;
      steps.push({
        id: batchStepId,
        type: 'BATCH_EXECUTION',
        phase: batchNumber,
        title: `Execute batch ${batchNumber}`,
        explanation: `Executes batch ${batchNumber} of ${batchCount}.`,
        dependsOn: [previousStepId],
      });

      const healthCheckStepId = `step-health-check-${batchNumber}`;
      steps.push({
        id: healthCheckStepId,
        type: 'HEALTH_CHECKPOINT',
        phase: batchNumber,
        title: `Review outcome of batch ${batchNumber}`,
        explanation: `Checks results before continuing past batch ${batchNumber}.`,
        dependsOn: [batchStepId],
      });

      if (batchNumber < batchCount) {
        const cooldownStepId = `step-cooldown-${batchNumber}`;
        steps.push({
          id: cooldownStepId,
          type: 'COOLDOWN',
          phase: batchNumber,
          title: `Cool down after batch ${batchNumber}`,
          explanation: `Pauses execution after batch ${batchNumber} before continuing to the next one.`,
          dependsOn: [healthCheckStepId],
        });
        previousStepId = cooldownStepId;
      } else {
        previousStepId = healthCheckStepId;
      }
    }

    steps.push({
      id: 'step-completion',
      type: 'COMPLETION',
      phase: batchCount + 1,
      title: 'Complete execution',
      explanation: 'Marks the execution plan as complete.',
      dependsOn: [previousStepId],
    });

    return steps;
  }

  private buildPhases(steps: ExecutionStep[]): ExecutionPhase[] {
    const byPhase = new Map<number, string[]>();
    for (const step of steps) {
      const ids = byPhase.get(step.phase) ?? [];
      ids.push(step.id);
      byPhase.set(step.phase, ids);
    }

    const maxPhase = Math.max(...steps.map((step) => step.phase));

    return [...byPhase.entries()]
      .sort(([a], [b]) => a - b)
      .map(([index, stepIds]) => ({ index, name: this.phaseName(index, maxPhase), stepIds }));
  }

  private phaseName(index: number, maxPhase: number): string {
    if (index === 0) {
      return 'Preparation';
    }
    if (index === maxPhase) {
      return 'Completion';
    }
    return `Batch ${index}`;
  }

  private buildBatchSchedule(steps: ExecutionStep[], cooldownDurationMs: number): BatchSchedule {
    const batchSteps = steps.filter((step) => step.type === 'BATCH_EXECUTION');
    const entries: BatchScheduleEntry[] = [];
    let offset = this.config.interStepDelayMs;

    batchSteps.forEach((step, index) => {
      if (index > 0) {
        offset += this.config.interBatchDelayMs + cooldownDurationMs;
      }
      entries.push({ batchNumber: index + 1, stepId: step.id, relativeStartOffsetMs: offset });
    });

    return { batchCount: batchSteps.length, entries };
  }

  private buildExecutionWindows(phases: ExecutionPhase[], batchSchedule: BatchSchedule): ExecutionWindowPlan[] {
    return phases.map((phase) => {
      const start = this.phaseStartOffset(phase, batchSchedule);
      return { windowIndex: phase.index, relativeStartMs: start, relativeEndMs: start + this.config.windowDurationMs };
    });
  }

  private phaseStartOffset(phase: ExecutionPhase, batchSchedule: BatchSchedule): number {
    if (phase.index === 0) {
      return 0;
    }
    const batchEntry = batchSchedule.entries.find((entry) => entry.batchNumber === phase.index);
    if (batchEntry) {
      return batchEntry.relativeStartOffsetMs;
    }
    const lastEntry = batchSchedule.entries[batchSchedule.entries.length - 1];
    return lastEntry.relativeStartOffsetMs + this.config.interStepDelayMs;
  }

  private buildRetryPlan(steps: ExecutionStep[]): RetryPlan {
    const entries = steps
      .filter((step) => step.type === 'BATCH_EXECUTION')
      .map((step) => ({ stepId: step.id, maxAttempts: this.config.maxRetryAttempts, backoffMs: this.geometricBackoff() }));
    return { entries };
  }

  private geometricBackoff(): number[] {
    const delays: number[] = [];
    let delay = this.config.retryBackoffBaseMs;
    for (let attempt = 0; attempt < this.config.maxRetryAttempts; attempt += 1) {
      delays.push(delay);
      delay *= this.config.retryBackoffMultiplier;
    }
    return delays;
  }

  private buildCooldownPlan(steps: ExecutionStep[], cooldownDurationMs: number, category: RecommendationCategory): CooldownPlan {
    const reason =
      category === 'RISK'
        ? `Extended cooldown (x${this.config.cooldownRiskMultiplier}) because the decision category is RISK.`
        : 'Standard cooldown between batches to observe results before continuing.';

    const entries = steps
      .filter((step) => step.type === 'COOLDOWN')
      .map((step) => ({ stepId: step.id, durationMs: cooldownDurationMs, reason }));

    return { entries };
  }

  private buildDependencyGraph(steps: ExecutionStep[]): DependencyGraph {
    const edges: DependencyEdge[] = [];
    for (const step of steps) {
      for (const dependencyId of step.dependsOn) {
        edges.push({ fromStepId: dependencyId, toStepId: step.id });
      }
    }
    return { edges };
  }

  private buildExplanation(decisionReport: DecisionReport, batchCount: number, cooldownDurationMs: number): string {
    const recommendation = decisionReport.finalRecommendation;
    const cooldownMinutes = (cooldownDurationMs * MINUTES_PER_MS).toFixed(0);
    const conflictNote = decisionReport.conflicts.length > 0 ? `, resolving ${decisionReport.conflicts.length} conflict(s)` : '';

    return (
      `Execution plan for decision "${recommendation?.title}" (category ${recommendation?.category}, ` +
      `confidence ${decisionReport.confidenceScore.toFixed(2)}): ${batchCount} batch(es) with a ${cooldownMinutes}-minute ` +
      `cooldown between batches. Considered ${decisionReport.supportingEvidence.length} recommendation(s) total${conflictNote}.`
    );
  }
}
