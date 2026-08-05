import { WorkerService } from './worker.service';
import { ExecutionTaskPipeline } from '../../../execution-orchestrator/domain/entities/execution-task-pipeline.entity';
import { BlueprintStepTaskGenerationStrategy } from '../../../execution-orchestrator/domain/strategies/blueprint-step-task-generation.strategy';
import { TransitiveDependentSkipPolicy } from '../../../execution-orchestrator/domain/strategies/transitive-dependent-skip.policy';
import { TaskNotFoundException } from '../../../execution-orchestrator/domain/exceptions/task-not-found.exception';
import { InvalidPipelineStatusTransitionException } from '../../../execution-orchestrator/domain/exceptions/invalid-pipeline-status-transition.exception';
import { ExecutionBlueprint, ExecutionStep } from '../../../execution-planning/domain/execution-blueprint';
import { DecisionReport } from '../../../decision-intelligence/domain/decision-report';
import { TaskSelectionDecision } from '../../../execution-runtime/domain/task-selection-decision';
import { FixedClock } from '../../../execution/infrastructure/clock/fixed-clock';
import { TaskExecutionPort, TaskExecutionOutcome } from '../../domain/ports/task-execution.port';
import { NoTaskSelectedException } from '../../domain/exceptions/no-task-selected.exception';
import { PipelineDecisionMismatchException } from '../../domain/exceptions/pipeline-decision-mismatch.exception';
import { TaskNotExecutableException } from '../../domain/exceptions/task-not-executable.exception';
import { InternalTaskExecutionAdapter } from '../../infrastructure/adapters/internal-task-execution.adapter';
import { EmailDeliveryExecutionService } from '../../../email-delivery/application/services/email-delivery-execution.service';
import { NullEmailProvider } from '../../../email-provider/infrastructure/adapters/null-email-provider.adapter';
import { ProviderSelectionEngineService } from '../../../provider-selection/application/services/provider-selection-engine.service';
import { DeterministicProviderSelectionStrategy } from '../../../provider-selection/domain/strategies/deterministic-provider-selection.strategy';
import { DEFAULT_PROVIDER_SELECTION_CONFIG } from '../../../provider-selection/domain/provider-selection-config';
import { ExecutionEventRecorder } from '../../../execution-tracking/domain/ports/execution-event-recorder.port';
import { ExecutionEventQueryService } from '../../../execution-tracking/application/services/execution-event-query.service';
import { EmailProviderManagerService } from '../../../deliverability/application/services/email-provider-manager.service';
import { EmailProviderHealthRepository, EmailProviderHealthSnapshot } from '../../../deliverability/domain/ports/email-provider-health.repository';

function fakeEventRecorder(): ExecutionEventRecorder {
  return { record: jest.fn().mockResolvedValue(undefined) };
}

/** Minimal in-memory stand-in for the Provider Manager's persisted circuit-breaker state — real
 * behavior is covered by email-provider-manager.service.spec.ts; this end-to-end test only needs
 * the Provider Manager to be genuinely present in the chain, not its own circuit-breaker logic. */
function inMemoryHealthRepository(): EmailProviderHealthRepository {
  const store = new Map<string, EmailProviderHealthSnapshot>();
  return {
    get: async (providerId: string) => store.get(providerId) ?? null,
    getAll: async () => Array.from(store.values()),
    recordSuccess: async (providerId: string, now: Date) => {
      store.set(providerId, { providerId, consecutiveFailures: 0, lastFailureAt: null, lastSuccessAt: now, circuitOpenUntil: null });
    },
    recordFailure: async (providerId: string, now: Date) => {
      const prior = store.get(providerId);
      store.set(providerId, { providerId, consecutiveFailures: (prior?.consecutiveFailures ?? 0) + 1, lastFailureAt: now, lastSuccessAt: prior?.lastSuccessAt ?? null, circuitOpenUntil: null });
    },
    forceOpen: async () => undefined,
    forceClose: async () => undefined,
  };
}

function fakeManagerConfig(): { get<T>(key: string, defaultValue?: T): T } {
  return { get: <T>(_key: string, defaultValue?: T) => defaultValue as T };
}

/** M28.5 — the Provider Manager's constructor now also takes the attachment-resolution/domain-
 * readiness gate. This end-to-end test's pipeline never builds a request with attachments, so the
 * gate never triggers — these are inert stand-ins, not exercised behavior (that's covered by
 * email-provider-manager.service.spec.ts's own dedicated "attachment resolution gate" tests). */
function fakeAttachmentResolver(): { resolve: jest.Mock } {
  return { resolve: jest.fn() };
}

function fakeDomainReadiness(): { checkReadiness: jest.Mock } {
  return { checkReadiness: jest.fn() };
}

function fakeSecurityAudit(): { record: jest.Mock } {
  return { record: jest.fn().mockResolvedValue(undefined) };
}

/** Defaults to "no prior execution found" — the correct default for every test in this file
 * that isn't specifically exercising the idempotency guard (see the dedicated describe block
 * below), since only a prior SUCCESS event for the same (campaignId, traceId) should ever
 * cause the guard to refuse execution. */
function fakeEventQueryService(priorEvents: Array<{ eventType: string; status: string }> = []): ExecutionEventQueryService {
  return {
    findByCampaignIdAndTraceId: jest.fn().mockResolvedValue(priorEvents),
  } as unknown as ExecutionEventQueryService;
}

const CAMPAIGN_ID = '123e4567-e89b-12d3-a456-426614174000';
const NOW = new Date('2026-01-05T10:00:00.000Z');

function buildStep(id: string, dependsOn: string[] = []): ExecutionStep {
  return { id, type: 'BATCH_EXECUTION', phase: 0, title: `Step ${id}`, explanation: `Explanation for ${id}`, dependsOn };
}

function fakeDecisionReport(): DecisionReport {
  return {
    id: 'decision-1',
    campaignId: CAMPAIGN_ID,
    correlationId: 'correlation-1',
    userId: 'candidate-1',
    finalRecommendation: null,
    confidenceScore: 1,
    businessJustification: 'test',
    explanation: 'test',
    supportingEvidence: [],
    conflicts: [],
  };
}

function buildBlueprint(steps: ExecutionStep[]): ExecutionBlueprint {
  return {
    campaignId: CAMPAIGN_ID,
    steps,
    phases: [],
    batchSchedule: { batchCount: 0, entries: [] },
    executionWindows: [],
    retryPlan: { entries: [] },
    pacingStrategy: { interBatchDelayMs: 0, interStepDelayMs: 0 },
    cooldownPlan: { entries: [] },
    dependencyGraph: { edges: [] },
    explanation: 'test blueprint',
    basedOn: fakeDecisionReport(),
  };
}

function buildPipeline(steps: ExecutionStep[]): ExecutionTaskPipeline {
  const blueprint = buildBlueprint(steps);
  const tasks = new BlueprintStepTaskGenerationStrategy().generate(blueprint, NOW);
  return ExecutionTaskPipeline.create(CAMPAIGN_ID, tasks, blueprint, new TransitiveDependentSkipPolicy(), NOW);
}

function buildDecision(taskId: string | null, reasonCode = 'SELECTED_BY_PRIORITY'): TaskSelectionDecision {
  return {
    campaignId: CAMPAIGN_ID,
    selectedTaskId: taskId,
    reasonCode,
    explanation: 'test decision',
    candidates: taskId ? [{ taskId, rank: 1, explanation: 'test candidate' }] : [],
    correlationId: 'correlation-1',
    userId: 'candidate-1',
  };
}

function successPort(): TaskExecutionPort {
  return { execute: jest.fn().mockResolvedValue({ success: true, reason: 'Simulated success.', failureReason: null } satisfies TaskExecutionOutcome) };
}

function failurePort(failureReason = 'Simulated failure.'): TaskExecutionPort {
  return {
    execute: jest.fn().mockResolvedValue({ success: false, reason: 'Simulated attempt.', failureReason } satisfies TaskExecutionOutcome),
  };
}

describe('WorkerService', () => {
  describe('successful execution', () => {
    it('transitions the task READY -> RUNNING -> COMPLETED and returns a COMPLETED result', async () => {
      const pipeline = buildPipeline([buildStep('a')]);
      const worker = new WorkerService(new FixedClock(NOW), successPort(), fakeEventRecorder(), fakeEventQueryService());

      const result = await worker.execute(pipeline, buildDecision('a'));

      expect(pipeline.findTask('a')!.status).toBe('COMPLETED');
      expect(result.status).toBe('COMPLETED');
      expect(result.failureReason).toBeNull();
    });

    it('records a company interaction-free, single-task transition with no side effects on other tasks', async () => {
      const pipeline = buildPipeline([buildStep('a'), buildStep('b', ['a'])]);
      const worker = new WorkerService(new FixedClock(NOW), successPort(), fakeEventRecorder(), fakeEventQueryService());

      await worker.execute(pipeline, buildDecision('a'));

      expect(pipeline.findTask('b')!.status).toBe('READY'); // promoted by completeTask's own readiness pass, untouched by the Worker directly
    });
  });

  describe('failed execution', () => {
    it('transitions the task READY -> RUNNING -> FAILED and returns a FAILED result with the failure reason', async () => {
      const pipeline = buildPipeline([buildStep('a')]);
      const worker = new WorkerService(new FixedClock(NOW), failurePort('provider unavailable'), fakeEventRecorder(), fakeEventQueryService());

      const result = await worker.execute(pipeline, buildDecision('a'));

      expect(pipeline.findTask('a')!.status).toBe('FAILED');
      expect(pipeline.findTask('a')!.failureReason).toBe('provider unavailable');
      expect(result.status).toBe('FAILED');
      expect(result.failureReason).toBe('provider unavailable');
    });

    it('falls back to a default failure reason when the port omits one', async () => {
      const pipeline = buildPipeline([buildStep('a')]);
      const port: TaskExecutionPort = { execute: jest.fn().mockResolvedValue({ success: false, reason: 'x', failureReason: null }) };
      const worker = new WorkerService(new FixedClock(NOW), port, fakeEventRecorder(), fakeEventQueryService());

      const result = await worker.execute(pipeline, buildDecision('a'));

      expect(result.failureReason).toBe('Task execution reported failure with no specific reason.');
    });

    it('cascades a skip to dependents on failure, exactly as the pipeline aggregate already guarantees', async () => {
      const pipeline = buildPipeline([buildStep('a'), buildStep('b', ['a'])]);
      const worker = new WorkerService(new FixedClock(NOW), failurePort(), fakeEventRecorder(), fakeEventQueryService());

      await worker.execute(pipeline, buildDecision('a'));

      expect(pipeline.findTask('b')!.status).toBe('SKIPPED');
    });
  });

  describe('invalid task state', () => {
    it('refuses to execute a task that is not READY (still PENDING)', async () => {
      const pipeline = buildPipeline([buildStep('a'), buildStep('b', ['a'])]);
      const worker = new WorkerService(new FixedClock(NOW), successPort(), fakeEventRecorder(), fakeEventQueryService());

      await expect(worker.execute(pipeline, buildDecision('b'))).rejects.toThrow(TaskNotExecutableException);
    });

    it('refuses to execute a task that is already RUNNING', async () => {
      const pipeline = buildPipeline([buildStep('a')]);
      pipeline.startTask('a', NOW);
      const worker = new WorkerService(new FixedClock(NOW), successPort(), fakeEventRecorder(), fakeEventQueryService());

      await expect(worker.execute(pipeline, buildDecision('a'))).rejects.toThrow(TaskNotExecutableException);
    });

    it('refuses to execute a task that is already terminal (COMPLETED)', async () => {
      const pipeline = buildPipeline([buildStep('a')]);
      pipeline.startTask('a', NOW);
      pipeline.completeTask('a', NOW);
      const worker = new WorkerService(new FixedClock(NOW), successPort(), fakeEventRecorder(), fakeEventQueryService());

      await expect(worker.execute(pipeline, buildDecision('a'))).rejects.toThrow(TaskNotExecutableException);
    });

    it('propagates the pipeline-level guard when the pipeline is not ACTIVE, even if the task is READY', async () => {
      const pipeline = buildPipeline([buildStep('a')]);
      pipeline.pause(NOW);
      const worker = new WorkerService(new FixedClock(NOW), successPort(), fakeEventRecorder(), fakeEventQueryService());

      await expect(worker.execute(pipeline, buildDecision('a'))).rejects.toThrow(InvalidPipelineStatusTransitionException);
    });
  });

  describe('missing task', () => {
    it('throws TaskNotFoundException when the decision references an id absent from the pipeline', async () => {
      const pipeline = buildPipeline([buildStep('a')]);
      const worker = new WorkerService(new FixedClock(NOW), successPort(), fakeEventRecorder(), fakeEventQueryService());

      await expect(worker.execute(pipeline, buildDecision('unknown'))).rejects.toThrow(TaskNotFoundException);
    });
  });

  describe('deterministic execution', () => {
    it('produces equal results for two independently constructed, identically-operated pipelines', async () => {
      const pipelineA = buildPipeline([buildStep('a')]);
      const pipelineB = buildPipeline([buildStep('a')]);
      const workerA = new WorkerService(new FixedClock(NOW), successPort(), fakeEventRecorder(), fakeEventQueryService());
      const workerB = new WorkerService(new FixedClock(NOW), successPort(), fakeEventRecorder(), fakeEventQueryService());

      const resultA = await workerA.execute(pipelineA, buildDecision('a'));
      const resultB = await workerB.execute(pipelineB, buildDecision('a'));

      expect(resultA).toEqual(resultB);
    });

    it('executes only the one selected task, never iterating the rest of the pipeline', async () => {
      const pipeline = buildPipeline([buildStep('a'), buildStep('independent')]);
      const port = successPort();
      const worker = new WorkerService(new FixedClock(NOW), port, fakeEventRecorder(), fakeEventQueryService());

      await worker.execute(pipeline, buildDecision('a'));

      expect(port.execute).toHaveBeenCalledTimes(1);
      expect(pipeline.findTask('independent')!.status).toBe('READY'); // never touched
    });
  });

  describe('execution metadata', () => {
    it('computes duration from the clock readings taken around execution', async () => {
      const clock = new FixedClock(NOW);
      const port: TaskExecutionPort = {
        execute: jest.fn().mockImplementation(async () => {
          clock.advance(1500);
          return { success: true, reason: 'Simulated success.', failureReason: null };
        }),
      };
      const pipeline = buildPipeline([buildStep('a')]);
      const worker = new WorkerService(clock, port, fakeEventRecorder(), fakeEventQueryService());

      const result = await worker.execute(pipeline, buildDecision('a'));

      expect(result.durationMs).toBe(1500);
      expect(result.executedAt).toEqual(new Date(NOW.getTime() + 1500));
    });

    it('carries campaignId and taskId for full traceability', async () => {
      const pipeline = buildPipeline([buildStep('a')]);
      const worker = new WorkerService(new FixedClock(NOW), successPort(), fakeEventRecorder(), fakeEventQueryService());

      const result = await worker.execute(pipeline, buildDecision('a'));

      expect(result.campaignId).toBe(CAMPAIGN_ID);
      expect(result.taskId).toBe('a');
    });

    it('carries the executed task\'s correlationId', async () => {
      const pipeline = buildPipeline([buildStep('a')]);
      const worker = new WorkerService(new FixedClock(NOW), successPort(), fakeEventRecorder(), fakeEventQueryService());

      const result = await worker.execute(pipeline, buildDecision('a'));

      expect(result.correlationId).toBe('correlation-1');
    });
  });

  describe('explainability', () => {
    it('surfaces the execution port reason on success', async () => {
      const pipeline = buildPipeline([buildStep('a')]);
      const port: TaskExecutionPort = { execute: jest.fn().mockResolvedValue({ success: true, reason: 'Custom success narrative.', failureReason: null }) };
      const worker = new WorkerService(new FixedClock(NOW), port, fakeEventRecorder(), fakeEventQueryService());

      const result = await worker.execute(pipeline, buildDecision('a'));

      expect(result.reason).toBe('Custom success narrative.');
    });

    it('surfaces both reason and failureReason on failure', async () => {
      const pipeline = buildPipeline([buildStep('a')]);
      const port: TaskExecutionPort = {
        execute: jest.fn().mockResolvedValue({ success: false, reason: 'Attempted delivery.', failureReason: 'Timed out.' }),
      };
      const worker = new WorkerService(new FixedClock(NOW), port, fakeEventRecorder(), fakeEventQueryService());

      const result = await worker.execute(pipeline, buildDecision('a'));

      expect(result.reason).toBe('Attempted delivery.');
      expect(result.failureReason).toBe('Timed out.');
    });
  });

  describe('dependency injection', () => {
    it('honors an injected TaskExecutionPort, proving execution behavior is swappable without touching WorkerService', async () => {
      const pipeline = buildPipeline([buildStep('a')]);
      const customPort: TaskExecutionPort = {
        execute: jest.fn().mockResolvedValue({ success: false, reason: 'custom provider refused', failureReason: 'custom failure' }),
      };
      const worker = new WorkerService(new FixedClock(NOW), customPort, fakeEventRecorder(), fakeEventQueryService());

      const result = await worker.execute(pipeline, buildDecision('a'));

      expect(customPort.execute).toHaveBeenCalledWith(pipeline.findTask('a'));
      expect(result.status).toBe('FAILED');
      expect(result.failureReason).toBe('custom failure');
    });

    it('works end-to-end with the real default InternalTaskExecutionAdapter binding', async () => {
      const pipeline = buildPipeline([buildStep('a')]);
      const worker = new WorkerService(new FixedClock(NOW), new InternalTaskExecutionAdapter(), fakeEventRecorder(), fakeEventQueryService());

      const result = await worker.execute(pipeline, buildDecision('a'));

      expect(result.status).toBe('COMPLETED');
      expect(result.reason).toContain('internal simulation adapter');
    });

    it('works end-to-end through the real Milestone 28 chain (EmailDeliveryExecutionService -> EmailProviderManager -> ProviderSelectionEngine -> NullEmailProvider)', async () => {
      const pipeline = buildPipeline([buildStep('a')]);
      const clock = new FixedClock(NOW);
      const nullProvider = new NullEmailProvider(clock);
      const engine = new ProviderSelectionEngineService(
        [nullProvider],
        clock,
        new DeterministicProviderSelectionStrategy(DEFAULT_PROVIDER_SELECTION_CONFIG),
        fakeEventRecorder(),
      );
      const providerManager = new EmailProviderManagerService(
        [nullProvider],
        engine,
        inMemoryHealthRepository(),
        clock,
        fakeAttachmentResolver() as never,
        fakeDomainReadiness() as never,
        fakeSecurityAudit() as never,
        fakeManagerConfig() as never,
      );
      const worker = new WorkerService(clock, new EmailDeliveryExecutionService(providerManager, fakeEventRecorder()), fakeEventRecorder(), fakeEventQueryService());

      const result = await worker.execute(pipeline, buildDecision('a'));

      // NullEmailProvider always reports itself unavailable, so the Provider Selection Engine
      // rejects it outright — no provider is ever selected, and the task is faithfully marked
      // FAILED end to end. The Worker never needed to know a provider or a selection engine
      // exists behind the port at all.
      expect(result.status).toBe('FAILED');
      expect(pipeline.findTask('a')!.status).toBe('FAILED');
      expect(result.failureReason).toContain('No registered provider is eligible');
    });
  });

  describe('edge cases', () => {
    it('throws NoTaskSelectedException when the decision selected nothing', async () => {
      const pipeline = buildPipeline([buildStep('a')]);
      const worker = new WorkerService(new FixedClock(NOW), successPort(), fakeEventRecorder(), fakeEventQueryService());

      await expect(worker.execute(pipeline, buildDecision(null, 'NO_READY_TASKS'))).rejects.toThrow(NoTaskSelectedException);
    });

    it('throws PipelineDecisionMismatchException when the decision targets a different campaign', async () => {
      const pipeline = buildPipeline([buildStep('a')]);
      const mismatchedDecision: TaskSelectionDecision = { ...buildDecision('a'), campaignId: 'some-other-campaign' };
      const worker = new WorkerService(new FixedClock(NOW), successPort(), fakeEventRecorder(), fakeEventQueryService());

      await expect(worker.execute(pipeline, mismatchedDecision)).rejects.toThrow(PipelineDecisionMismatchException);
    });

    it('never calls the execution port at all when validation fails first', async () => {
      const pipeline = buildPipeline([buildStep('a')]);
      const port = successPort();
      const worker = new WorkerService(new FixedClock(NOW), port, fakeEventRecorder(), fakeEventQueryService());

      await expect(worker.execute(pipeline, buildDecision('unknown'))).rejects.toThrow(TaskNotFoundException);
      expect(port.execute).not.toHaveBeenCalled();
    });
  });
});
