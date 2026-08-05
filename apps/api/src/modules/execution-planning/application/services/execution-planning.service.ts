import { Inject, Injectable } from '@nestjs/common';
import { DecisionIntelligencePort, DECISION_INTELLIGENCE_PORT } from '../../../decision-intelligence/domain/ports/decision-intelligence.port';
import { ExecutionPlanningStrategy, EXECUTION_PLANNING_STRATEGY } from '../../domain/ports/execution-planning-strategy.port';
import { ExecutionBlueprint } from '../../domain/execution-blueprint';
import { ExecutionEventRecorder, EXECUTION_EVENT_RECORDER } from '../../../execution-tracking/domain/ports/execution-event-recorder.port';
import { EMPTY_BUSINESS_CONTEXT } from '../../../execution-tracking/domain/models/business-context';
import { ExecutionPlanningPort } from '../../domain/ports/execution-planning.port';

/**
 * The orchestration layer above the Decision Intelligence Engine (Milestone 7): transforms each
 * campaign's DecisionReport into one deterministic ExecutionBlueprint describing HOW the decided
 * action would be carried out. Consumes DecisionReports only — it has no dependency on the
 * Dispatcher, Scheduler, Campaign repository, or any other data source, and no knowledge of
 * SMTP, queues, workers, providers, APIs, or infrastructure. All planning logic lives in the
 * injected ExecutionPlanningStrategy, not here, so replacing it (including with a future AI
 * model) never requires a change to this service.
 */
@Injectable()
export class ExecutionPlanningService implements ExecutionPlanningPort {
  constructor(
    @Inject(DECISION_INTELLIGENCE_PORT) private readonly decisionIntelligenceService: DecisionIntelligencePort,
    @Inject(EXECUTION_PLANNING_STRATEGY) private readonly planningStrategy: ExecutionPlanningStrategy,
    @Inject(EXECUTION_EVENT_RECORDER) private readonly eventRecorder: ExecutionEventRecorder,
  ) {}

  /** One ExecutionBlueprint per campaign the Decision Intelligence Engine currently has a
   * DecisionReport for. */
  async generateExecutionBlueprints(): Promise<ExecutionBlueprint[]> {
    const decisionReports = await this.decisionIntelligenceService.generateDecisionReports();

    return Promise.all(
      decisionReports.map(async (report) => {
        const blueprint = this.planningStrategy.plan(report);

        await this.eventRecorder.record({
          eventType: 'EXECUTION_PLANNED',
          campaignId: blueprint.campaignId,
          executionId: null,
          correlationId: report.correlationId,
          traceId: report.correlationId,
          summary: `Execution blueprint built with ${blueprint.steps.length} step(s)`,
          explanation: `The execution planning strategy produced ${blueprint.phases.length} phase(s) and ${blueprint.steps.length} step(s) for this campaign.`,
          status: 'SUCCESS',
          metadata: { stepCount: String(blueprint.steps.length) },
          businessContext: { ...EMPTY_BUSINESS_CONTEXT, userId: report.userId, decisionId: report.id, recommendationId: report.finalRecommendation?.id ?? null },
        });

        return blueprint;
      }),
    );
  }
}
