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
import { ExecutionRuntimeService } from '../src/modules/execution-runtime/application/services/execution-runtime.service';
import { WorkerModule } from '../src/modules/worker/worker.module';
import { WorkerService } from '../src/modules/worker/application/services/worker.service';
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

// This is the first test in the codebase that touches a REAL Postgres connection during a
// Jest run (every other spec fakes PrismaService) — DATABASE_URL is normally supplied by
// ConfigModule/dotenv at app bootstrap, neither of which runs here, so it must be set
// explicitly. Matches the value in the repo root .env used throughout local development.
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://job_engine:change_me@localhost:5432/german_job_engine?schema=public';

const NOW = new Date('2026-01-05T10:00:00.000Z'); // a Monday

/** Deliberately permissive so campaign eligibility never depends on wall-clock time or German holidays. */
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

/**
 * M19 — Architecture Validation & Production Readiness.
 *
 * Proves the full wired Phase 4 chain (Recommendation -> Decision -> Planning ->
 * Orchestration -> Runtime -> Worker -> Email Delivery -> Provider Selection) is a genuinely
 * connected system, not just a collection of unit-tested links. Uses the REAL NestJS module
 * graph and REAL default strategy/service implementations throughout — only the three leaf
 * foundation repositories (Campaign, Company, UserProfile) are overridden with in-memory
 * fakes, purely to avoid needing to seed unrelated bounded contexts' own Postgres tables.
 * The execution-event store is NOT faked: PrismaExecutionEventRepository runs for real
 * against the live Postgres database, so this also proves M16-M18's persistence and
 * correlation/trace-id threading survive a real DB round-trip end to end.
 */
describe('Execution Pipeline (real DI graph, real Postgres event store) [e2e]', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let campaign: Campaign;
  let ownerId: string;
  // Every correlationId this describe block produces, across every test — cleaned up
  // unconditionally in afterAll regardless of pass/fail, so a failed assertion can never leave
  // rows behind. Necessary because blueprint step ids (traceId) are deterministic given this
  // fixture's fixed shape, so they collide across repeated runs of this same test file —
  // correlationId is the one genuinely-per-run-unique key available.
  const correlationIdsToClean: string[] = [];

  beforeAll(async () => {
    const campaignId = randomUUID();
    const companyId = randomUUID();
    const jobId = randomUUID();
    ownerId = randomUUID();

    const company = Company.create(companyId, ownerId, {
      name: 'Integration Test GmbH',
      industry: CompanyIndustry.IT_SOFTWARE,
      size: CompanySize.SMALL,
      location: CompanyLocation.create({ city: 'Berlin', country: 'Germany' }),
      contact: CompanyContact.create({ contactEmail: 'hr@integration-test.example' }),
    });

    const setupActor = Actor.candidate(ownerId);
    const setupCorrelationId = CorrelationId.create('integration-test-setup');

    campaign = Campaign.create(
      campaignId,
      ownerId,
      CampaignName.create('Integration Test Campaign'),
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
    // Forces CampaignHealthRecommendationStrategy to fire — otherwise no strategy has any
    // signal (no risk, no history, no health) and the chain correctly, deterministically
    // produces zero recommendations -> an empty blueprint -> a FINISHED (not ACTIVE) pipeline,
    // which would never reach the Worker. A low health score is the simplest real trigger.
    campaign.recordHealthAssessment(
      CampaignHealth.create({ healthScore: Probability.create(0.1), computedBy: 'integration-test' }),
      setupActor,
      setupCorrelationId,
    );

    const fakeCampaignRepository: CampaignRepository = {
      findById: jest.fn().mockResolvedValue(campaign),
      findByOwnerId: jest.fn().mockResolvedValue([campaign]),
      save: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      search: jest.fn().mockResolvedValue({ items: [campaign], total: 1 }),
    };
    const fakeCompanyRepository: CompanyRepository = {
      findById: jest.fn().mockResolvedValue(company),
      findByOwnerId: jest.fn().mockResolvedValue(company),
      save: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      search: jest.fn().mockResolvedValue({ items: [company], total: 1 }),
    };
    const fakeUserProfileRepository: UserProfileRepository = {
      findById: jest.fn().mockResolvedValue(null),
      findByUserId: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, ExecutionOrchestratorModule, ExecutionRuntimeModule, WorkerModule, ExecutionTrackingModule],
    })
      .overrideProvider(CAMPAIGN_REPOSITORY).useValue(fakeCampaignRepository)
      .overrideProvider(COMPANY_REPOSITORY).useValue(fakeCompanyRepository)
      .overrideProvider(USER_PROFILE_REPOSITORY).useValue(fakeUserProfileRepository)
      .overrideProvider(EXECUTION_CLOCK).useValue(new FixedClock(NOW))
      .compile();

    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    if (correlationIdsToClean.length > 0) {
      await prisma.executionEvent.deleteMany({ where: { correlationId: { in: correlationIdsToClean } } });
    }
    await moduleRef.close();
  });

  it('ExecutionRuntimeService independently traverses Recommendation -> Decision -> Planning -> Orchestration -> Runtime under one correlationId', async () => {
    const runtime = moduleRef.get(ExecutionRuntimeService);
    const eventQuery = moduleRef.get(ExecutionEventQueryService);

    const decisions = await runtime.selectNextTasks();
    const decision = decisions.find((d) => d.campaignId === campaign.id);
    expect(decision).toBeDefined();
    expect(decision!.selectedTaskId).not.toBeNull();
    correlationIdsToClean.push(decision!.correlationId);

    // Order not asserted — see the note in the next test: a frozen EXECUTION_CLOCK means every
    // event in this run shares one occurredAt millisecond, so Postgres tie-break order is undefined.
    const correlated = await eventQuery.findByCorrelationId(decision!.correlationId);
    expect(correlated.map((event) => event.eventType).sort()).toEqual(
      ['RECOMMENDATION_GENERATED', 'DECISION_MADE', 'EXECUTION_PLANNED', 'PIPELINE_ORCHESTRATED', 'TASK_SELECTED'].sort(),
    );
    expect(correlated.every((event) => event.correlationId === decision!.correlationId)).toBe(true);
    expect(correlated.every((event) => event.businessContext.userId === ownerId)).toBe(true);
  }, 30000);

  it('Worker executes a task from the SAME pipeline generation and records a correlated trail — real Postgres round trip (M26: WorkerModule no longer binds a generic email-every-task-type handler)', async () => {
    const orchestrator = moduleRef.get(ExecutionOrchestratorService);
    const worker = moduleRef.get(WorkerService);
    const eventQuery = moduleRef.get(ExecutionEventQueryService);

    // Deliberately does NOT go through ExecutionRuntimeService here: that service's own
    // selectNextTasks() triggers its own fresh, independently-correlated pipeline generation
    // internally (proven by the previous test), so a decision obtained from it can never be
    // fed into a separately-generated pipeline for Worker.execute() — there is currently no
    // persistence linking one generation to another within a bare orchestrator/runtime call
    // (M26's PipelineHydrationService, exercised via CampaignExecutionEntryPointService in
    // execution-activation.e2e-spec.ts, is what actually closes that gap for real activation).
    // To exercise Worker's own wiring honestly, this test generates the pipeline ONCE and
    // derives the decision from that same instance using the real default TASK_SELECTION_STRATEGY
    // implementation directly.
    const pipelines = await orchestrator.generatePipelines();
    const pipeline = pipelines.find((p) => p.campaignId === campaign.id);
    expect(pipeline).toBeDefined();

    const decision = new DeterministicTaskSelectionStrategy(DEFAULT_TASK_SELECTION_CONFIG).select(pipeline!);
    expect(decision.selectedTaskId).not.toBeNull();
    expect(decision.correlationId).toBe(pipeline!.correlationId);
    correlationIdsToClean.push(pipeline!.correlationId);

    // M26: WorkerModule's TASK_EXECUTION_PORT binding changed from EmailDeliveryExecutionService
    // (M12, which generically attempted a placeholder-content email for ANY task type — real
    // target/company/candidate data was never available to it) to
    // CampaignExecutionTaskHandlerService, which dispatches by real ExecutionStepType and only
    // ever attempts a real delivery for BATCH_EXECUTION steps, using per-target data supplied via
    // CampaignExecutionCallContextHolder — populated only by CampaignExecutionEntryPointService,
    // never by a bare WorkerService.execute() call like this one. Calling it directly here (the
    // freshly-generated pipeline's only READY task is step-preparation, a non-delivery step
    // anyway) correctly throws "called outside a withContext() scope" rather than silently
    // guessing at missing context — WorkerService's own M19 hardening (an unhandled exception
    // from TaskExecutionPort is caught, not left to crash) turns that into a real, traceable
    // FAILED result and a real TASK_EXECUTED/FAILURE event, exactly like any other infrastructure
    // failure. This is the correct, safe behavior post-M26, not a regression — see
    // execution-activation.e2e-spec.ts for the real BATCH_EXECUTION delivery-boundary coverage
    // this test used to (incidentally, via the old generic binding) provide.
    const result = await worker.execute(pipeline!, decision);
    expect(result.status).toBe('FAILED');
    expect(result.correlationId).toBe(pipeline!.correlationId);
    expect(result.failureReason).toContain('withContext() scope');

    // Order is intentionally NOT asserted here: this test freezes EXECUTION_CLOCK for
    // determinism, so every event in this run shares the exact same millisecond occurredAt —
    // Postgres does not guarantee tie-break order for `ORDER BY occurredAt ASC` on equal
    // values. A real SystemClock advances between calls in production; this is a deliberate,
    // documented property of testing under a frozen clock, not an ordering bug (see the M19
    // report for the note on adding a monotonic sequence column if strict same-millisecond
    // ordering ever becomes operationally important).
    const correlated = await eventQuery.findByCorrelationId(pipeline!.correlationId);
    expect(correlated.map((event) => event.eventType).sort()).toEqual(
      ['RECOMMENDATION_GENERATED', 'DECISION_MADE', 'EXECUTION_PLANNED', 'PIPELINE_ORCHESTRATED', 'TASK_EXECUTED'].sort(),
    );
    expect(correlated.every((event) => event.correlationId === pipeline!.correlationId)).toBe(true);

    // Deliberately scoped by correlationId first, THEN narrowed by traceId — not a bare
    // findByTraceId() call. Blueprint step ids are deterministic given a fixed campaign shape
    // (M7), so the same traceId can recur across separate pipeline generations (this test file's
    // own two tests produce an identical task id for that reason); traceId alone is therefore
    // not a globally safe lookup key. Only the (correlationId, traceId) PAIR uniquely identifies
    // one specific execution attempt — see the M19 report for this finding and its implication
    // for M17's Trust Center, which currently queries by traceId alone.
    const traced = correlated.filter((event) => event.traceId === decision.selectedTaskId);
    expect(traced.map((event) => event.eventType).sort()).toEqual(['TASK_EXECUTED']);
    expect(traced.every((event) => event.traceId === decision.selectedTaskId)).toBe(true);

    const taskExecuted = traced.find((event) => event.eventType === 'TASK_EXECUTED');
    expect(taskExecuted?.campaignId).toBe(campaign.id);
    expect(taskExecuted?.correlationId).toBe(pipeline!.correlationId);
  }, 30000);
});
