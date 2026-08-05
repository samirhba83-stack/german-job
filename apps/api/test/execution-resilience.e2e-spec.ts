import { randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import {
  CompanyIndustry,
  CompanySize,
  CampaignOutcomeGoal,
  CampaignStrategyType,
  Weekday,
} from '@german-job-engine/shared-types';

import { PrismaModule } from '../src/shared/infrastructure/database/prisma.module';
import { PrismaService } from '../src/shared/infrastructure/database/prisma.service';

import { ExecutionOrchestratorModule } from '../src/modules/execution-orchestrator/execution-orchestrator.module';
import { ExecutionOrchestratorService } from '../src/modules/execution-orchestrator/application/services/execution-orchestrator.service';
import { ExecutionRuntimeModule } from '../src/modules/execution-runtime/execution-runtime.module';
import { WorkerModule } from '../src/modules/worker/worker.module';
import { WorkerService } from '../src/modules/worker/application/services/worker.service';
import { TASK_EXECUTION_PORT, TaskExecutionPort, TaskExecutionOutcome } from '../src/modules/worker/domain/ports/task-execution.port';
import { ExecutionTask } from '../src/modules/execution-orchestrator/domain/entities/execution-task.entity';
import { ExecutionTrackingModule } from '../src/modules/execution-tracking/execution-tracking.module';
import { ExecutionEventQueryService } from '../src/modules/execution-tracking/application/services/execution-event-query.service';
import { DeterministicTaskSelectionStrategy } from '../src/modules/execution-runtime/domain/strategies/deterministic-task-selection.strategy';
import { DEFAULT_TASK_SELECTION_CONFIG } from '../src/modules/execution-runtime/domain/task-selection-config';

import { CAMPAIGN_REPOSITORY, CampaignRepository } from '../src/modules/campaigns/domain/repositories/campaign.repository.interface';
import { COMPANY_REPOSITORY, CompanyRepository } from '../src/modules/companies/domain/repositories/company.repository.interface';
import { USER_PROFILE_REPOSITORY, UserProfileRepository } from '../src/modules/profiles/domain/repositories/user-profile.repository.interface';
import { EXECUTION_CLOCK } from '../src/modules/execution/domain/ports/execution-clock.port';
import { FixedClock } from '../src/modules/execution/infrastructure/clock/fixed-clock';

import { Campaign } from '../src/modules/campaigns/domain/entities/campaign.entity';
import { CampaignName } from '../src/modules/campaigns/domain/value-objects/campaign-name.vo';
import { CampaignGoal } from '../src/modules/campaigns/domain/value-objects/campaign-goal.vo';
import { CampaignStrategyProfile } from '../src/modules/campaigns/domain/value-objects/campaign-strategy-profile.vo';
import { SmartBatchPlan } from '../src/modules/campaigns/domain/value-objects/smart-batch-plan.vo';
import { ExecutionWindow } from '../src/modules/campaigns/domain/value-objects/execution-window.vo';
import { RateLimitProfile } from '../src/modules/campaigns/domain/value-objects/rate-limit-profile.vo';
import { Actor } from '../src/modules/campaigns/domain/value-objects/actor.vo';
import { CorrelationId } from '../src/modules/campaigns/domain/value-objects/correlation-id.vo';
import { CampaignHealth } from '../src/modules/campaigns/domain/value-objects/campaign-health.vo';
import { Probability } from '../src/modules/campaigns/domain/value-objects/probability.vo';

import { Company } from '../src/modules/companies/domain/entities/company.entity';
import { CompanyLocation } from '../src/modules/companies/domain/value-objects/company-location.vo';
import { CompanyContact } from '../src/modules/companies/domain/value-objects/company-contact.vo';

process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://job_engine:change_me@localhost:5432/german_job_engine?schema=public';

const NOW = new Date('2026-01-05T10:00:00.000Z'); // a Monday

function alwaysOpenWindow(): ExecutionWindow {
  return ExecutionWindow.create({
    allowedWeekdays: [
      Weekday.MONDAY, Weekday.TUESDAY, Weekday.WEDNESDAY, Weekday.THURSDAY,
      Weekday.FRIDAY, Weekday.SATURDAY, Weekday.SUNDAY,
    ],
    dailyStartHour: 0,
    dailyEndHour: 24,
    timezone: 'UTC',
    respectHolidays: false,
  });
}

function buildCampaign(label: string): { campaign: Campaign; company: Company; ownerId: string } {
  const campaignId = randomUUID();
  const companyId = randomUUID();
  const jobId = randomUUID();
  const ownerId = randomUUID();

  const company = Company.create(companyId, ownerId, {
    name: `${label} GmbH`,
    industry: CompanyIndustry.IT_SOFTWARE,
    size: CompanySize.SMALL,
    location: CompanyLocation.create({ city: 'Berlin', country: 'Germany' }),
    contact: CompanyContact.create({ contactEmail: `hr@${label.toLowerCase()}.example` }),
  });

  const setupActor = Actor.candidate(ownerId);
  const setupCorrelationId = CorrelationId.create(`resilience-test-setup-${label}`);

  const campaign = Campaign.create(
    campaignId,
    ownerId,
    CampaignName.create(`${label} Campaign`),
    CampaignGoal.create({ targetApplicationCount: 5, desiredOutcome: CampaignOutcomeGoal.REPLIES }),
    CampaignStrategyProfile.create(CampaignStrategyType.BALANCED),
    SmartBatchPlan.create({ baseBatchSize: 5, minBatchSize: 1, maxBatchSize: 10 }),
    alwaysOpenWindow(),
    RateLimitProfile.default(),
    setupActor,
    setupCorrelationId,
  );
  campaign.addTarget(jobId, companyId, setupActor, setupCorrelationId);
  campaign.markReady(setupActor, setupCorrelationId);
  campaign.start(setupActor, setupCorrelationId);
  // Forces CampaignHealthRecommendationStrategy to fire, exactly as in execution-pipeline.e2e-spec.ts.
  campaign.recordHealthAssessment(
    CampaignHealth.create({ healthScore: Probability.create(0.1), computedBy: 'resilience-test' }),
    setupActor,
    setupCorrelationId,
  );

  return { campaign, company, ownerId };
}

/**
 * A TaskExecutionPort that throws instead of resolving — simulating an infrastructure exception
 * (a crashed network call, an unhandled provider SDK error) rather than a normal, well-formed
 * failure outcome. Used only by the dedicated infra-exception test below; every other test in
 * this file uses WorkerModule's real default binding (EmailDeliveryExecutionService ->
 * NullEmailProvider), which fails *gracefully* by returning { success: false }, not by throwing.
 */
class ThrowingTaskExecutionPort implements TaskExecutionPort {
  async execute(_task: ExecutionTask): Promise<TaskExecutionOutcome> {
    throw new Error('Simulated infrastructure exception (e.g. a network timeout mid-call).');
  }
}

/** Always reports success — used only by the dedicated idempotency test that needs a task to
 * genuinely COMPLETE once, so a second attempt has something real to be blocked by. Every other
 * test in this file uses the real default (NullEmailProvider, always fails) deliberately, since
 * a retry of a FAILED task must remain allowed — only a repeat of a SUCCESSFUL one should not. */
class SucceedingTaskExecutionPort implements TaskExecutionPort {
  async execute(_task: ExecutionTask): Promise<TaskExecutionOutcome> {
    return { success: true, reason: 'Simulated successful delivery.', failureReason: null };
  }
}

/**
 * M19 — Architecture Validation & Production Readiness, expanded scope.
 *
 * Complements execution-pipeline.e2e-spec.ts (which proves the pipeline is a genuinely connected
 * system) by validating the specific properties M19's second pass asked for: failure recovery,
 * idempotency, concurrency, and persistence fidelity — under the real DI graph and real Postgres
 * event store, not mocks. Three independent campaigns are registered: A and B share one module
 * (real NullEmailProvider, always fails) so every A/B test incidentally also proves cross-campaign
 * isolation; C is isolated in its own module bound to a fake that always succeeds, needed only by
 * the idempotency test that requires a task to genuinely complete.
 *
 * This suite drove two real fixes in WorkerService (see its own doc comment): an infrastructure
 * exception during execution is now caught and recorded instead of leaving a task stuck with no
 * audit trail, and an idempotency guard now blocks re-executing a task that already succeeded
 * (while still allowing retries of failures). Tests that exercise these are labeled "FIXED:" and
 * assert the corrected behavior directly; where a test instead proves a remaining, accepted
 * architectural property (e.g. that pipeline regeneration isn't itself persisted/linked across
 * calls), it says so in its own comment — see docs/M19-VALIDATION-REPORT.md for the full account.
 */
describe('Execution Pipeline Resilience — Failure Recovery, Idempotency, Concurrency, Persistence (M19) [e2e]', () => {
  let moduleRef: TestingModule;
  let throwingModuleRef: TestingModule;
  let succeedingModuleRef: TestingModule;
  let prisma: PrismaService;
  let campaignA: Campaign;
  let campaignB: Campaign;
  let campaignC: Campaign;
  const correlationIdsToClean: string[] = [];

  beforeAll(async () => {
    const a = buildCampaign('ResilienceA');
    const b = buildCampaign('ResilienceB');
    const c = buildCampaign('ResilienceC');
    campaignA = a.campaign;
    campaignB = b.campaign;
    campaignC = c.campaign;

    const campaignsById = new Map([[campaignA.id, campaignA], [campaignB.id, campaignB]]);
    const companiesById = new Map([[a.company.id, a.company], [b.company.id, b.company]]);

    const fakeCampaignRepository: CampaignRepository = {
      findById: jest.fn().mockImplementation(async (id: string) => campaignsById.get(id) ?? null),
      findByOwnerId: jest.fn().mockImplementation(async (ownerId: string) => {
        const found = [...campaignsById.values()].filter((c) => c.ownerId === ownerId);
        return found;
      }),
      save: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      search: jest.fn().mockResolvedValue({ items: [...campaignsById.values()], total: campaignsById.size }),
    };
    const fakeCompanyRepository: CompanyRepository = {
      findById: jest.fn().mockImplementation(async (id: string) => companiesById.get(id) ?? null),
      findByOwnerId: jest.fn().mockImplementation(async (ownerId: string) =>
        [...companiesById.values()].find((c) => c.ownerId === ownerId) ?? null),
      save: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      search: jest.fn().mockResolvedValue({ items: [...companiesById.values()], total: companiesById.size }),
    };
    const fakeUserProfileRepository: UserProfileRepository = {
      findById: jest.fn().mockResolvedValue(null),
      findByUserId: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    const commonOverrides = (builder: ReturnType<typeof Test.createTestingModule>) =>
      builder
        .overrideProvider(CAMPAIGN_REPOSITORY).useValue(fakeCampaignRepository)
        .overrideProvider(COMPANY_REPOSITORY).useValue(fakeCompanyRepository)
        .overrideProvider(USER_PROFILE_REPOSITORY).useValue(fakeUserProfileRepository)
        .overrideProvider(EXECUTION_CLOCK).useValue(new FixedClock(NOW));

    moduleRef = await commonOverrides(
      Test.createTestingModule({
        imports: [PrismaModule, ExecutionOrchestratorModule, ExecutionRuntimeModule, WorkerModule, ExecutionTrackingModule],
      }),
    ).compile();

    // A second, independent DI container sharing the same fixtures, with TASK_EXECUTION_PORT
    // replaced by a throwing fake. NestJS resolves provider overrides at compile time, so a
    // second test-only failure mode requires a second compiled module, not a runtime monkeypatch
    // of the first — this keeps the primary moduleRef's default wiring (EmailDeliveryExecutionService
    // -> NullEmailProvider) completely untouched for every other test in this file.
    throwingModuleRef = await commonOverrides(
      Test.createTestingModule({
        imports: [PrismaModule, ExecutionOrchestratorModule, ExecutionRuntimeModule, WorkerModule, ExecutionTrackingModule],
      }),
    )
      .overrideProvider(TASK_EXECUTION_PORT).useValue(new ThrowingTaskExecutionPort())
      .compile();

    // A third, independent DI container scoped to campaignC ONLY (not A/B) and with
    // TASK_EXECUTION_PORT replaced by a fake that always succeeds. Deliberately isolated from
    // the shared campaignA/B fixtures used everywhere else in this file: the idempotency test
    // that uses this module needs a task to genuinely reach a persisted SUCCESS state, and that
    // state must not leak into or be affected by any other test's use of campaignA/B (which stay
    // on the real NullEmailProvider and must always be free to fail, and retry after failing).
    const fakeCampaignRepositoryC: CampaignRepository = {
      findById: jest.fn().mockImplementation(async (id: string) => (id === campaignC.id ? campaignC : null)),
      findByOwnerId: jest.fn().mockImplementation(async (ownerId: string) => (ownerId === c.ownerId ? [campaignC] : [])),
      save: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      search: jest.fn().mockResolvedValue({ items: [campaignC], total: 1 }),
    };
    const fakeCompanyRepositoryC: CompanyRepository = {
      findById: jest.fn().mockImplementation(async (id: string) => (id === c.company.id ? c.company : null)),
      findByOwnerId: jest.fn().mockImplementation(async (ownerId: string) => (ownerId === c.ownerId ? c.company : null)),
      save: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      search: jest.fn().mockResolvedValue({ items: [c.company], total: 1 }),
    };

    succeedingModuleRef = await Test.createTestingModule({
      imports: [PrismaModule, ExecutionOrchestratorModule, ExecutionRuntimeModule, WorkerModule, ExecutionTrackingModule],
    })
      .overrideProvider(CAMPAIGN_REPOSITORY).useValue(fakeCampaignRepositoryC)
      .overrideProvider(COMPANY_REPOSITORY).useValue(fakeCompanyRepositoryC)
      .overrideProvider(USER_PROFILE_REPOSITORY).useValue(fakeUserProfileRepository)
      .overrideProvider(EXECUTION_CLOCK).useValue(new FixedClock(NOW))
      .overrideProvider(TASK_EXECUTION_PORT).useValue(new SucceedingTaskExecutionPort())
      .compile();

    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    if (correlationIdsToClean.length > 0) {
      await prisma.executionEvent.deleteMany({ where: { correlationId: { in: correlationIdsToClean } } });
    }
    await moduleRef.close();
    await throwingModuleRef.close();
    await succeedingModuleRef.close();
  });

  describe('Failure Recovery Validation', () => {
    it('a graceful provider failure (NullEmailProvider) leaves the task correctly FAILED — not stuck — with a full audit trail', async () => {
      const orchestrator = moduleRef.get(ExecutionOrchestratorService);
      const worker = moduleRef.get(WorkerService);
      const eventQuery = moduleRef.get(ExecutionEventQueryService);

      const pipelines = await orchestrator.generatePipelines();
      // generatePipelines() processes every campaign the fake repository knows about in one
      // Promise.all (moduleRef/throwingModuleRef both register campaignA AND campaignB) — track
      // every correlationId it produces here, not just the one this test inspects, or the other
      // campaign's recommendation/decision/planning/orchestration events leak into Postgres
      // untracked and uncleaned.
      correlationIdsToClean.push(...pipelines.map((p) => p.correlationId));
      const pipeline = pipelines.find((p) => p.campaignId === campaignA.id)!;
      const decision = new DeterministicTaskSelectionStrategy(DEFAULT_TASK_SELECTION_CONFIG).select(pipeline);
      correlationIdsToClean.push(pipeline.correlationId);

      const result = await worker.execute(pipeline, decision);
      expect(result.status).toBe('FAILED');

      // The pipeline's own in-memory state correctly reflects the failure — no stuck task, no
      // silent inconsistency between what the caller was told and what the aggregate records.
      const task = pipeline.findTask(decision.selectedTaskId!)!;
      expect(task.status).toBe('FAILED');
      expect(task.failureReason).toBeTruthy();
      expect(task.finishedAt).not.toBeNull();

      const correlated = await eventQuery.findByCorrelationId(pipeline.correlationId);
      const taskExecuted = correlated.find((e) => e.eventType === 'TASK_EXECUTED');
      expect(taskExecuted?.status).toBe('FAILURE');
    }, 30000);

    it('FIXED: an infrastructure exception mid-execution is caught and translated into a normal FAILED result — no stuck task, full audit trail', async () => {
      const orchestrator = throwingModuleRef.get(ExecutionOrchestratorService);
      const worker = throwingModuleRef.get(WorkerService);
      const eventQuery = throwingModuleRef.get(ExecutionEventQueryService);

      const pipelines = await orchestrator.generatePipelines();
      // generatePipelines() processes every campaign the fake repository knows about in one
      // Promise.all (moduleRef/throwingModuleRef both register campaignA AND campaignB) — track
      // every correlationId it produces here, not just the one this test inspects, or the other
      // campaign's recommendation/decision/planning/orchestration events leak into Postgres
      // untracked and uncleaned.
      correlationIdsToClean.push(...pipelines.map((p) => p.correlationId));
      const pipeline = pipelines.find((p) => p.campaignId === campaignA.id)!;
      const decision = new DeterministicTaskSelectionStrategy(DEFAULT_TASK_SELECTION_CONFIG).select(pipeline);
      correlationIdsToClean.push(pipeline.correlationId);

      // WorkerService.execute() now wraps `taskExecutionPort.execute(task)` in a try/catch (M19
      // fix): an exception (as opposed to a normal { success: false } outcome) is caught,
      // translated into pipeline.failTask(), and recorded exactly like any other failure — it no
      // longer propagates out and leaves the task stuck at RUNNING with no audit trail. This test
      // previously proved the opposite (the gap); it now proves the fix.
      const result = await worker.execute(pipeline, decision);
      expect(result.status).toBe('FAILED');
      expect(result.failureReason).toContain('Infrastructure exception during task execution');

      const task = pipeline.findTask(decision.selectedTaskId!)!;
      expect(task.status).toBe('FAILED'); // no longer stuck RUNNING
      expect(task.finishedAt).not.toBeNull();

      const correlated = await eventQuery.findByCorrelationId(pipeline.correlationId);
      const taskExecuted = correlated.find((e) => e.eventType === 'TASK_EXECUTED');
      expect(taskExecuted).toBeDefined(); // full audit trail now exists for the real failure
      expect(taskExecuted?.status).toBe('FAILURE');
    }, 30000);
  });

  describe('Idempotency Validation', () => {
    it('double-executing the SAME task on the SAME pipeline instance is safely rejected, not duplicated', async () => {
      const orchestrator = moduleRef.get(ExecutionOrchestratorService);
      const worker = moduleRef.get(WorkerService);
      const eventQuery = moduleRef.get(ExecutionEventQueryService);

      const pipelines = await orchestrator.generatePipelines();
      // generatePipelines() processes every campaign the fake repository knows about in one
      // Promise.all (moduleRef/throwingModuleRef both register campaignA AND campaignB) — track
      // every correlationId it produces here, not just the one this test inspects, or the other
      // campaign's recommendation/decision/planning/orchestration events leak into Postgres
      // untracked and uncleaned.
      correlationIdsToClean.push(...pipelines.map((p) => p.correlationId));
      const pipeline = pipelines.find((p) => p.campaignId === campaignA.id)!;
      const decision = new DeterministicTaskSelectionStrategy(DEFAULT_TASK_SELECTION_CONFIG).select(pipeline);
      correlationIdsToClean.push(pipeline.correlationId);

      await worker.execute(pipeline, decision);
      // A second attempt against the exact same pipeline object and decision — simulating a
      // naive caller retrying without checking prior outcome — is correctly rejected by the
      // task's own state guard (ExecutionTask.markRunning requires status === READY).
      await expect(worker.execute(pipeline, decision)).rejects.toThrow('is not executable');

      const correlated = await eventQuery.findByCorrelationId(pipeline.correlationId);
      const executedEvents = correlated.filter((e) => e.eventType === 'TASK_EXECUTED');
      expect(executedEvents).toHaveLength(1); // exactly one — no duplicate business action
    }, 30000);

    it('regenerating a pipeline for the same campaign after a FAILED execution correctly ALLOWS a retry — failures are never permanently blocked', async () => {
      const orchestrator = moduleRef.get(ExecutionOrchestratorService);
      const worker = moduleRef.get(WorkerService);
      const eventQuery = moduleRef.get(ExecutionEventQueryService);

      // First generation + execution, exactly like any real caller's first attempt. Uses the
      // real NullEmailProvider, so this always fails.
      const firstPipelines = await orchestrator.generatePipelines();
      correlationIdsToClean.push(...firstPipelines.map((p) => p.correlationId)); // see the note above: campaignB is also processed as a side effect
      const firstPipeline = firstPipelines.find((p) => p.campaignId === campaignA.id)!;
      const firstDecision = new DeterministicTaskSelectionStrategy(DEFAULT_TASK_SELECTION_CONFIG).select(firstPipeline);
      const firstResult = await worker.execute(firstPipeline, firstDecision);
      expect(firstResult.status).toBe('FAILED');

      // Second, independent generation for the SAME campaign — simulating a retry after a
      // process restart, where nothing persisted a pipeline-level link to the first attempt (a
      // real, documented property of ExecutionOrchestratorService — see
      // execution-pipeline.e2e-spec.ts and docs/M19-VALIDATION-REPORT.md §2.3 finding 1). The
      // task identity is deterministic (same blueprint step id — M7 precedent), so this is
      // genuinely "retry the same task", not a coincidentally-similar different one.
      const secondPipelines = await orchestrator.generatePipelines();
      correlationIdsToClean.push(...secondPipelines.map((p) => p.correlationId));
      const secondPipeline = secondPipelines.find((p) => p.campaignId === campaignA.id)!;
      const secondDecision = new DeterministicTaskSelectionStrategy(DEFAULT_TASK_SELECTION_CONFIG).select(secondPipeline);
      expect(secondDecision.selectedTaskId).toBe(firstDecision.selectedTaskId);

      // The M19 idempotency guard only blocks a repeat of an already-SUCCESSFUL execution — a
      // prior FAILURE must never permanently block a retry, or a transient provider outage would
      // brick a campaign forever. This is the correctness half of the fix, proven directly.
      const secondResult = await worker.execute(secondPipeline, secondDecision);
      expect(secondResult.status).toBe('FAILED'); // ran again, failed again — NullEmailProvider — but it DID run

      const firstTrail = await eventQuery.findByCorrelationId(firstPipeline.correlationId);
      const secondTrail = await eventQuery.findByCorrelationId(secondPipeline.correlationId);
      expect(firstTrail.filter((e) => e.eventType === 'TASK_EXECUTED')).toHaveLength(1);
      expect(secondTrail.filter((e) => e.eventType === 'TASK_EXECUTED')).toHaveLength(1);
    }, 30000);

    it('FIXED: regenerating a pipeline after a SUCCESSFUL execution is blocked by the idempotency guard — no duplicate business action', async () => {
      const orchestrator = succeedingModuleRef.get(ExecutionOrchestratorService);
      const worker = succeedingModuleRef.get(WorkerService);
      const eventQuery = succeedingModuleRef.get(ExecutionEventQueryService);

      // First generation + execution against the SucceedingTaskExecutionPort fake — the task
      // genuinely completes, which is the one prerequisite the previous "gap" scenario needed to
      // actually demonstrate a real duplicate business action.
      const firstPipelines = await orchestrator.generatePipelines();
      correlationIdsToClean.push(...firstPipelines.map((p) => p.correlationId));
      const firstPipeline = firstPipelines.find((p) => p.campaignId === campaignC.id)!;
      const firstDecision = new DeterministicTaskSelectionStrategy(DEFAULT_TASK_SELECTION_CONFIG).select(firstPipeline);
      const firstResult = await worker.execute(firstPipeline, firstDecision);
      expect(firstResult.status).toBe('COMPLETED');

      // Second, independent generation for the SAME campaign — the exact scenario that
      // previously produced a real duplicate delivery. The idempotency guard now queries the
      // persisted event store (by campaignId + traceId) before starting the task and refuses.
      const secondPipelines = await orchestrator.generatePipelines();
      correlationIdsToClean.push(...secondPipelines.map((p) => p.correlationId));
      const secondPipeline = secondPipelines.find((p) => p.campaignId === campaignC.id)!;
      const secondDecision = new DeterministicTaskSelectionStrategy(DEFAULT_TASK_SELECTION_CONFIG).select(secondPipeline);
      expect(secondDecision.selectedTaskId).toBe(firstDecision.selectedTaskId);

      await expect(worker.execute(secondPipeline, secondDecision)).rejects.toThrow('has already completed successfully');

      // Exactly one TASK_EXECUTED event exists across BOTH correlation chains combined — the
      // second attempt never reached pipeline.startTask(), so it never recorded anything.
      const firstTrail = await eventQuery.findByCorrelationId(firstPipeline.correlationId);
      const secondTrail = await eventQuery.findByCorrelationId(secondPipeline.correlationId);
      const totalExecuted = [...firstTrail, ...secondTrail].filter((e) => e.eventType === 'TASK_EXECUTED');
      expect(totalExecuted).toHaveLength(1);
      expect(totalExecuted[0].status).toBe('SUCCESS');
    }, 30000);
  });

  describe('Concurrency Validation', () => {
    it('concurrent execute() calls racing for the SAME task on the SAME pipeline: exactly one wins, the loser is safely rejected — never two winners', async () => {
      const orchestrator = moduleRef.get(ExecutionOrchestratorService);
      const worker = moduleRef.get(WorkerService);
      const eventQuery = moduleRef.get(ExecutionEventQueryService);

      const pipelines = await orchestrator.generatePipelines();
      // generatePipelines() processes every campaign the fake repository knows about in one
      // Promise.all (moduleRef/throwingModuleRef both register campaignA AND campaignB) — track
      // every correlationId it produces here, not just the one this test inspects, or the other
      // campaign's recommendation/decision/planning/orchestration events leak into Postgres
      // untracked and uncleaned.
      correlationIdsToClean.push(...pipelines.map((p) => p.correlationId));
      const pipeline = pipelines.find((p) => p.campaignId === campaignA.id)!;
      const decision = new DeterministicTaskSelectionStrategy(DEFAULT_TASK_SELECTION_CONFIG).select(pipeline);
      correlationIdsToClean.push(pipeline.correlationId);

      // Two callers race to execute the identical task on the identical in-memory pipeline —
      // e.g. two worker-pool threads both picking up the same TaskSelectionDecision. This relies
      // on ExecutionTaskPipeline.startTask() mutating status synchronously (before the first
      // `await`), which is a real but easy-to-miss property of Node's single-threaded event
      // loop, not an explicit lock — worth proving empirically rather than assuming.
      const outcomes = await Promise.allSettled([
        worker.execute(pipeline, decision),
        worker.execute(pipeline, decision),
      ]);

      const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
      const rejected = outcomes.filter((o) => o.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const correlated = await eventQuery.findByCorrelationId(pipeline.correlationId);
      expect(correlated.filter((e) => e.eventType === 'TASK_EXECUTED')).toHaveLength(1); // never two
    }, 30000);

    it('two independent campaigns processed concurrently produce zero cross-contamination of correlation context or business context', async () => {
      const orchestrator = moduleRef.get(ExecutionOrchestratorService);
      const worker = moduleRef.get(WorkerService);
      const eventQuery = moduleRef.get(ExecutionEventQueryService);

      // generatePipelines() already processes every campaign returned by the repository's
      // search() concurrently via Promise.all internally — this is the natural concurrency
      // point in the real architecture, not an artificial parallelization added by this test.
      const pipelines = await orchestrator.generatePipelines();
      // generatePipelines() processes every campaign the fake repository knows about in one
      // Promise.all (moduleRef/throwingModuleRef both register campaignA AND campaignB) — track
      // every correlationId it produces here, not just the one this test inspects, or the other
      // campaign's recommendation/decision/planning/orchestration events leak into Postgres
      // untracked and uncleaned.
      correlationIdsToClean.push(...pipelines.map((p) => p.correlationId));
      const pipelineA = pipelines.find((p) => p.campaignId === campaignA.id)!;
      const pipelineB = pipelines.find((p) => p.campaignId === campaignB.id)!;
      expect(pipelineA.correlationId).not.toBe(pipelineB.correlationId);

      const decisionA = new DeterministicTaskSelectionStrategy(DEFAULT_TASK_SELECTION_CONFIG).select(pipelineA);
      const decisionB = new DeterministicTaskSelectionStrategy(DEFAULT_TASK_SELECTION_CONFIG).select(pipelineB);
      correlationIdsToClean.push(pipelineA.correlationId, pipelineB.correlationId);

      // Execute both concurrently too, not just generate concurrently.
      await Promise.all([
        worker.execute(pipelineA, decisionA),
        worker.execute(pipelineB, decisionB),
      ]);

      const [trailA, trailB] = await Promise.all([
        eventQuery.findByCorrelationId(pipelineA.correlationId),
        eventQuery.findByCorrelationId(pipelineB.correlationId),
      ]);

      expect(trailA.length).toBeGreaterThan(0);
      expect(trailB.length).toBeGreaterThan(0);
      // No event from A's correlation chain references B's campaign or owner, and vice versa —
      // the concrete meaning of "no context leakage between concurrent executions". Not every
      // event type carries campaignId (e.g. PROVIDER_SELECTED/EMAIL_DELIVERY_FAILED are recorded
      // with campaignId: null by design — ProviderSelectionEngineService has no campaign-level
      // knowledge at all, per M18's "derive, don't duplicate" rule), so the assertion is "never
      // the WRONG campaign", not "always A's campaign".
      expect(trailA.some((e) => e.campaignId !== null)).toBe(true); // sanity: not every row is null
      expect(trailA.every((e) => e.campaignId === null || e.campaignId === campaignA.id)).toBe(true);
      expect(trailA.every((e) => e.businessContext.userId !== campaignB.ownerId)).toBe(true);
      expect(trailB.every((e) => e.campaignId === null || e.campaignId === campaignB.id)).toBe(true);
      expect(trailB.every((e) => e.businessContext.userId !== campaignA.ownerId)).toBe(true);
      // And no correlationId bleeds across: no row tagged with A's correlationId shows up when
      // querying by B's, or vice versa (findByCorrelationId already filters server-side, but the
      // real assertion worth making is that the two id sets are disjoint end to end).
      const idsA = new Set(trailA.map((e) => e.id));
      const idsB = new Set(trailB.map((e) => e.id));
      expect([...idsA].some((id) => idsB.has(id))).toBe(false);
    }, 30000);
  });

  describe('Persistence Validation', () => {
    it('the persisted row for a recorded event matches the in-memory execution result field-for-field after a real Postgres round trip', async () => {
      const orchestrator = moduleRef.get(ExecutionOrchestratorService);
      const worker = moduleRef.get(WorkerService);

      const pipelines = await orchestrator.generatePipelines();
      // generatePipelines() processes every campaign the fake repository knows about in one
      // Promise.all (moduleRef/throwingModuleRef both register campaignA AND campaignB) — track
      // every correlationId it produces here, not just the one this test inspects, or the other
      // campaign's recommendation/decision/planning/orchestration events leak into Postgres
      // untracked and uncleaned.
      correlationIdsToClean.push(...pipelines.map((p) => p.correlationId));
      const pipeline = pipelines.find((p) => p.campaignId === campaignA.id)!;
      const decision = new DeterministicTaskSelectionStrategy(DEFAULT_TASK_SELECTION_CONFIG).select(pipeline);
      correlationIdsToClean.push(pipeline.correlationId);

      const result = await worker.execute(pipeline, decision);

      // Bypasses the repository/query-service abstraction deliberately, reading the raw Postgres
      // row directly via Prisma — the point of this test is to confirm the persistence mapper
      // hasn't silently dropped or transformed a field between the domain event and the DB row.
      const row = await prisma.executionEvent.findFirst({
        where: { correlationId: pipeline.correlationId, eventType: 'TASK_EXECUTED', traceId: decision.selectedTaskId! },
      });

      expect(row).not.toBeNull();
      expect(row!.campaignId).toBe(result.campaignId);
      expect(row!.correlationId).toBe(result.correlationId);
      expect(row!.traceId).toBe(decision.selectedTaskId);
      expect(row!.status).toBe(result.status === 'COMPLETED' ? 'SUCCESS' : 'FAILURE');
      expect((row!.context as Record<string, unknown>).workerId).toBe('worker-default');
      expect((row!.metadata as Record<string, unknown>).durationMs).toBe(String(result.durationMs));
    }, 30000);
  });
});
