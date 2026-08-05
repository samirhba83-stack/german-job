import {
  CampaignStatus,
  CampaignOutcomeGoal,
  CampaignStrategyType,
  CampaignReasonCode,
  Weekday,
  ReplayScope,
} from '@german-job-engine/shared-types';
import { Campaign } from './campaign.entity';
import { CampaignName } from '../value-objects/campaign-name.vo';
import { CampaignGoal } from '../value-objects/campaign-goal.vo';
import { CampaignStrategyProfile } from '../value-objects/campaign-strategy-profile.vo';
import { SmartBatchPlan } from '../value-objects/smart-batch-plan.vo';
import { ExecutionWindow } from '../value-objects/execution-window.vo';
import { RateLimitProfile } from '../value-objects/rate-limit-profile.vo';
import { Actor } from '../value-objects/actor.vo';
import { CorrelationId } from '../value-objects/correlation-id.vo';
import { CampaignReason } from '../value-objects/campaign-reason.vo';
import { CooldownPeriod } from '../value-objects/cooldown-period.vo';
import { CampaignHealth } from '../value-objects/campaign-health.vo';
import { CampaignIntelligence } from '../value-objects/campaign-intelligence.vo';
import { CampaignCreated } from '../events/campaign-created.event';
import { CampaignTransitioned } from '../events/campaign-transitioned.event';
import { InvalidCampaignStatusTransitionException } from '../exceptions/invalid-campaign-status-transition.exception';
import { UnauthorizedCampaignActionException } from '../exceptions/unauthorized-campaign-action.exception';
import { MissingCampaignReasonException } from '../exceptions/missing-campaign-reason.exception';
import { MissingCampaignTargetException } from '../exceptions/missing-campaign-target.exception';
import { CampaignNotEditableException } from '../exceptions/campaign-not-editable.exception';
import { DuplicateCampaignTargetException } from '../exceptions/duplicate-campaign-target.exception';

const OWNER_ID = 'candidate-1';

function correlationId(): CorrelationId {
  return CorrelationId.create('corr-1');
}

function goal(count = 5): CampaignGoal {
  return CampaignGoal.create({ targetApplicationCount: count, desiredOutcome: CampaignOutcomeGoal.REPLIES });
}

function strategy(): CampaignStrategyProfile {
  return CampaignStrategyProfile.create(CampaignStrategyType.BALANCED);
}

function batchPlan(): SmartBatchPlan {
  return SmartBatchPlan.create({ baseBatchSize: 5, minBatchSize: 1, maxBatchSize: 10 });
}

/** Covers every day/hour so lifecycle tests aren't incidentally wall-clock-dependent on the
 * newly-wired ExecutionWindowPolicy — the window-rejection behavior itself is covered by its
 * own dedicated tests below, with an explicit `now`. */
function executionWindow(): ExecutionWindow {
  return ExecutionWindow.create({
    allowedWeekdays: [
      Weekday.MONDAY,
      Weekday.TUESDAY,
      Weekday.WEDNESDAY,
      Weekday.THURSDAY,
      Weekday.FRIDAY,
      Weekday.SATURDAY,
      Weekday.SUNDAY,
    ],
    dailyStartHour: 0,
    dailyEndHour: 24,
    timezone: 'UTC',
    respectHolidays: false,
  });
}

function createCampaign(): Campaign {
  return Campaign.create(
    '123e4567-e89b-12d3-a456-426614174000',
    OWNER_ID,
    CampaignName.create('Berlin Backend Roles'),
    goal(),
    strategy(),
    batchPlan(),
    executionWindow(),
    RateLimitProfile.default(),
    Actor.candidate(OWNER_ID),
    correlationId(),
  );
}

describe('Campaign', () => {
  it('starts DRAFT and raises CampaignCreated + CampaignTransitioned', () => {
    const campaign = createCampaign();

    expect(campaign.status).toBe(CampaignStatus.DRAFT);
    expect(campaign.ownerId).toBe(OWNER_ID);
    expect(campaign.domainEvents).toHaveLength(2);
    expect(campaign.domainEvents[0]).toBeInstanceOf(CampaignCreated);
    expect(campaign.domainEvents[1]).toBeInstanceOf(CampaignTransitioned);
    expect(campaign.timeline.entries()).toHaveLength(1);
  });

  it('rejects creation without an owner', () => {
    expect(() =>
      Campaign.create(
        '123e4567-e89b-12d3-a456-426614174000',
        '',
        CampaignName.create('X'),
        goal(),
        strategy(),
        batchPlan(),
        executionWindow(),
        RateLimitProfile.default(),
        Actor.candidate('x'),
        correlationId(),
      ),
    ).toThrow(/cannot exist without an owner/);
  });

  describe('readiness', () => {
    it('refuses to become READY without at least one target', () => {
      const campaign = createCampaign();
      expect(() => campaign.markReady(Actor.candidate(OWNER_ID), correlationId())).toThrow(MissingCampaignTargetException);
    });

    it('becomes READY once a target exists', () => {
      const campaign = createCampaign();
      campaign.addTarget('job-1', 'company-1', Actor.candidate(OWNER_ID), correlationId());
      campaign.markReady(Actor.candidate(OWNER_ID), correlationId());
      expect(campaign.status).toBe(CampaignStatus.READY);
    });

    it('refuses a duplicate target for the same job', () => {
      const campaign = createCampaign();
      campaign.addTarget('job-1', 'company-1', Actor.candidate(OWNER_ID), correlationId());
      expect(() => campaign.addTarget('job-1', 'company-1', Actor.candidate(OWNER_ID), correlationId())).toThrow(
        DuplicateCampaignTargetException,
      );
    });
  });

  function readyCampaign(): Campaign {
    const campaign = createCampaign();
    campaign.addTarget('job-1', 'company-1', Actor.candidate(OWNER_ID), correlationId());
    campaign.addTarget('job-2', 'company-2', Actor.candidate(OWNER_ID), correlationId());
    campaign.markReady(Actor.candidate(OWNER_ID), correlationId());
    return campaign;
  }

  it('walks the full happy path: Draft -> Ready -> Running -> Paused -> Resuming -> Running -> Completed -> Archived', () => {
    const campaign = readyCampaign();
    campaign.clearDomainEvents();

    campaign.start(Actor.candidate(OWNER_ID), correlationId());
    expect(campaign.status).toBe(CampaignStatus.RUNNING);
    expect(campaign.startedAt).not.toBeNull();

    campaign.pause(Actor.candidate(OWNER_ID), correlationId());
    expect(campaign.status).toBe(CampaignStatus.PAUSED);

    campaign.resume(Actor.candidate(OWNER_ID), correlationId());
    expect(campaign.status).toBe(CampaignStatus.RESUMING);

    campaign.confirmResume(Actor.candidate(OWNER_ID), correlationId());
    expect(campaign.status).toBe(CampaignStatus.RUNNING);

    campaign.complete(Actor.candidate(OWNER_ID), correlationId());
    expect(campaign.status).toBe(CampaignStatus.COMPLETED);
    expect(campaign.completedAt).not.toBeNull();
    expect(campaign.isTerminal()).toBe(true);

    campaign.archive(Actor.candidate(OWNER_ID), correlationId());
    expect(campaign.status).toBe(CampaignStatus.ARCHIVED);
  });

  it('cycles through COOLING_DOWN back to RUNNING, only for system/automation actors', () => {
    const campaign = readyCampaign();
    campaign.start(Actor.candidate(OWNER_ID), correlationId());

    expect(() =>
      campaign.enterCooldown(
        Actor.candidate(OWNER_ID),
        correlationId(),
        CooldownPeriod.create({
          startedAt: new Date(),
          until: new Date(Date.now() + 60_000),
          reason: CampaignReasonCode.COMPANY_FATIGUE_DETECTED,
        }),
      ),
    ).toThrow(UnauthorizedCampaignActionException);

    campaign.enterCooldown(
      Actor.system('fatigue-monitor'),
      correlationId(),
      CooldownPeriod.create({
        startedAt: new Date(),
        until: new Date(Date.now() + 60_000),
        reason: CampaignReasonCode.COMPANY_FATIGUE_DETECTED,
      }),
    );
    expect(campaign.status).toBe(CampaignStatus.COOLING_DOWN);
    expect(campaign.cooldown).not.toBeNull();

    campaign.resume(Actor.candidate(OWNER_ID), correlationId());
    expect(campaign.cooldown).toBeNull();
    campaign.confirmResume(Actor.candidate(OWNER_ID), correlationId());
    expect(campaign.status).toBe(CampaignStatus.RUNNING);
  });

  describe('exit lanes', () => {
    it('stops with a mandatory reason and can be resumed afterward', () => {
      const campaign = readyCampaign();
      campaign.start(Actor.candidate(OWNER_ID), correlationId());
      const reason = CampaignReason.create(CampaignReasonCode.MANUAL_OVERRIDE);

      campaign.stop(Actor.candidate(OWNER_ID), correlationId(), reason);
      expect(campaign.status).toBe(CampaignStatus.STOPPED);
      expect(campaign.isTerminal()).toBe(false);

      campaign.resume(Actor.candidate(OWNER_ID), correlationId());
      expect(campaign.status).toBe(CampaignStatus.RESUMING);
    });

    it('refuses stop without a reason', () => {
      const campaign = readyCampaign();
      campaign.start(Actor.candidate(OWNER_ID), correlationId());
      expect(() => campaign.stop(Actor.candidate(OWNER_ID), correlationId(), undefined as any)).toThrow(
        MissingCampaignReasonException,
      );
    });

    it('cancels only for the owning candidate or an admin', () => {
      const campaign = readyCampaign();
      const reason = CampaignReason.create(CampaignReasonCode.CANDIDATE_REQUEST);

      expect(() => campaign.cancel(Actor.candidate('someone-else'), correlationId(), reason)).toThrow(
        UnauthorizedCampaignActionException,
      );

      campaign.cancel(Actor.admin('admin-1'), correlationId(), reason);
      expect(campaign.status).toBe(CampaignStatus.CANCELLED);
      expect(campaign.isTerminal()).toBe(true);
    });

    it('archives from any non-terminal state', () => {
      const campaign = createCampaign();
      campaign.archive(Actor.admin('admin-1'), correlationId());
      expect(campaign.status).toBe(CampaignStatus.ARCHIVED);
    });
  });

  describe('guardrails', () => {
    it('refuses an unreachable transition', () => {
      const campaign = createCampaign();
      expect(() => campaign.start(Actor.candidate(OWNER_ID), correlationId())).toThrow(
        InvalidCampaignStatusTransitionException,
      );
    });

    it('refuses editing once the campaign is running', () => {
      const campaign = readyCampaign();
      campaign.start(Actor.candidate(OWNER_ID), correlationId());
      expect(() => campaign.update({ name: CampaignName.create('New name') }, Actor.candidate(OWNER_ID), correlationId())).toThrow(
        CampaignNotEditableException,
      );
    });
  });

  describe('batches, dispatch, retry & replay', () => {
    it('plans a batch, dispatches targets, completes the batch and detects goal reached', () => {
      const campaign = Campaign.create(
        '123e4567-e89b-12d3-a456-426614174000',
        OWNER_ID,
        CampaignName.create('Single-target campaign'),
        goal(1),
        strategy(),
        batchPlan(),
        executionWindow(),
        RateLimitProfile.default(),
        Actor.candidate(OWNER_ID),
        correlationId(),
      );
      campaign.addTarget('job-1', 'company-1', Actor.candidate(OWNER_ID), correlationId());
      campaign.markReady(Actor.candidate(OWNER_ID), correlationId());
      campaign.start(Actor.candidate(OWNER_ID), correlationId());
      campaign.clearDomainEvents();

      const batch = campaign.planNextBatch(Actor.system('scheduler'), correlationId());
      expect(batch.targetIds).toHaveLength(1);
      expect(campaign.targets[0].status).toBe('QUEUED');

      const targetId = campaign.targets[0].id;
      campaign.dispatchTarget(targetId, Actor.system('dispatcher'), correlationId());
      expect(campaign.targets[0].status).toBe('DISPATCHED');
      expect(campaign.findCompanyMemory('company-1')?.alreadyApplied).toBe(true);

      campaign.completeBatch(batch.id, Actor.system('scheduler'), correlationId());
      expect(campaign.checkpoint).not.toBeNull();

      const goalReached = campaign.domainEvents.some((e) => e.constructor.name === 'DynamicGoalReached');
      expect(goalReached).toBe(true);
    });

    it('retries a failed target up to the max attempt count, then exhausts retries', () => {
      const campaign = createCampaign();
      campaign.addTarget('job-1', 'company-1', Actor.candidate(OWNER_ID), correlationId());
      campaign.markReady(Actor.candidate(OWNER_ID), correlationId());
      campaign.start(Actor.candidate(OWNER_ID), correlationId());
      const batch = campaign.planNextBatch(Actor.system('scheduler'), correlationId());
      const targetId = batch.targetIds[0];

      campaign.recordTargetFailure(targetId, 'smtp timeout', Actor.system('dispatcher'), correlationId());
      expect(campaign.targets[0].status).toBe('FAILED');

      campaign.retryFailedTargets(Actor.system('retry-worker'), correlationId(), 3);
      expect(campaign.targets[0].status).toBe('PENDING');

      // Exhaust: fail again until attempt count reaches the max.
      campaign.recordTargetFailure(targetId, 'smtp timeout', Actor.system('dispatcher'), correlationId());
      campaign.recordTargetFailure(targetId, 'smtp timeout', Actor.system('dispatcher'), correlationId());
      campaign.retryFailedTargets(Actor.system('retry-worker'), correlationId(), 3);
      expect(campaign.targets[0].status).toBe('FAILED');
    });

    it('replay never re-includes an already-dispatched target', () => {
      const campaign = createCampaign();
      campaign.addTarget('job-1', 'company-1', Actor.candidate(OWNER_ID), correlationId());
      campaign.addTarget('job-2', 'company-2', Actor.candidate(OWNER_ID), correlationId());
      campaign.markReady(Actor.candidate(OWNER_ID), correlationId());
      campaign.start(Actor.candidate(OWNER_ID), correlationId());
      const batch = campaign.planNextBatch(Actor.system('scheduler'), correlationId());
      campaign.dispatchTarget(batch.targetIds[0], Actor.system('dispatcher'), correlationId());
      campaign.recordTargetFailure(batch.targetIds[1], 'bounce', Actor.system('dispatcher'), correlationId());

      campaign.replay(ReplayScope.ALL_FAILED, Actor.system('replay-worker'), correlationId());

      const dispatchedTarget = campaign.findTarget(batch.targetIds[0]);
      const failedTarget = campaign.findTarget(batch.targetIds[1]);
      expect(dispatchedTarget?.status).toBe('DISPATCHED');
      expect(failedTarget?.status).toBe('PENDING');
    });
  });

  describe('reserved intelligence hooks', () => {
    it('records a health assessment and raises CampaignHealthChanged', () => {
      const campaign = createCampaign();
      campaign.clearDomainEvents();

      campaign.recordHealthAssessment(CampaignHealth.create({ computedBy: 'health-engine' }), Actor.automation('health-engine'), correlationId());

      expect(campaign.health?.computedBy).toBe('health-engine');
      expect(campaign.domainEvents).toHaveLength(1);
    });

    it('records an intelligence assessment silently, with no domain event', () => {
      const campaign = createCampaign();
      campaign.clearDomainEvents();

      campaign.recordIntelligenceAssessment(
        CampaignIntelligence.create({ computedBy: 'ai-engine' }),
        Actor.automation('ai-engine'),
      );

      expect(campaign.intelligence?.computedBy).toBe('ai-engine');
      expect(campaign.domainEvents).toHaveLength(0);
    });
  });

  it('does not raise domain events when reconstituted from persistence, and carries the loaded version', () => {
    const campaign = Campaign.reconstitute(
      '123e4567-e89b-12d3-a456-426614174000',
      {
        ownerId: OWNER_ID,
        name: CampaignName.create('X'),
        status: CampaignStatus.DRAFT,
        strategy: strategy(),
        goal: goal(),
        batchPlan: batchPlan(),
        executionWindow: executionWindow(),
        rateLimitProfile: RateLimitProfile.default(),
        adaptiveSpeedProfile: null,
        targets: [],
        batches: [],
        companyMemory: [],
        checkpoint: null,
        cooldown: null,
        timeline: createCampaign().timeline,
        health: null,
        intelligence: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: null,
        completedAt: null,
      },
      7,
    );

    expect(campaign.domainEvents).toHaveLength(0);
    expect(campaign.version).toBe(7);
  });

  describe('M1 hardening — optimistic concurrency, status guards, dormant policy wiring', () => {
    it('starts a freshly created campaign at version 0', () => {
      expect(createCampaign().version).toBe(0);
    });

    it.each([
      ['dispatchTarget', (c: Campaign) => c.dispatchTarget('missing-target', Actor.system('x'), correlationId())],
      ['skipTarget', (c: Campaign) => c.skipTarget('missing-target', CampaignReason.create(CampaignReasonCode.OTHER), Actor.system('x'), correlationId())],
      ['recordTargetFailure', (c: Campaign) => c.recordTargetFailure('missing-target', 'boom', Actor.system('x'), correlationId())],
      ['completeBatch', (c: Campaign) => c.completeBatch('missing-batch', Actor.system('x'), correlationId())],
    ])('%s refuses to run unless the campaign is RUNNING', (_name, invoke) => {
      const campaign = createCampaign(); // still DRAFT
      expect(() => invoke(campaign)).toThrow(InvalidCampaignStatusTransitionException);
    });

    it('dispatchTarget refuses once the campaign is paused, even for a target queued before the pause', () => {
      const campaign = readyCampaign();
      campaign.start(Actor.candidate(OWNER_ID), correlationId());
      const batch = campaign.planNextBatch(Actor.system('scheduler'), correlationId());
      campaign.pause(Actor.candidate(OWNER_ID), correlationId());

      expect(() => campaign.dispatchTarget(batch.targetIds[0], Actor.system('worker'), correlationId())).toThrow(
        InvalidCampaignStatusTransitionException,
      );
    });

    it('planNextBatch refuses outside the configured execution window', () => {
      const narrowWindow = ExecutionWindow.create({
        allowedWeekdays: [Weekday.MONDAY],
        dailyStartHour: 8,
        dailyEndHour: 9,
        timezone: 'UTC',
      });
      const campaign = Campaign.create(
        '123e4567-e89b-12d3-a456-426614174000',
        OWNER_ID,
        CampaignName.create('Narrow window campaign'),
        goal(),
        strategy(),
        batchPlan(),
        narrowWindow,
        RateLimitProfile.default(),
        Actor.candidate(OWNER_ID),
        correlationId(),
      );
      campaign.addTarget('job-1', 'company-1', Actor.candidate(OWNER_ID), correlationId());
      campaign.markReady(Actor.candidate(OWNER_ID), correlationId());
      campaign.start(Actor.candidate(OWNER_ID), correlationId());

      const tuesdayNoon = new Date('2026-01-06T12:00:00.000Z'); // a Tuesday — outside "Monday 8-9 UTC only"
      expect(() => campaign.planNextBatch(Actor.system('scheduler'), correlationId(), tuesdayNoon)).toThrow(
        /execution window/,
      );

      const mondayEightAm = new Date('2026-01-05T08:30:00.000Z'); // a Monday, inside the window
      expect(() => campaign.planNextBatch(Actor.system('scheduler'), correlationId(), mondayEightAm)).not.toThrow();
    });

    it('planNextBatch refuses once the daily rate limit would be exceeded', () => {
      const campaign = Campaign.create(
        '123e4567-e89b-12d3-a456-426614174000',
        OWNER_ID,
        CampaignName.create('Rate limited campaign'),
        goal(1),
        strategy(),
        SmartBatchPlan.create({ baseBatchSize: 1, minBatchSize: 1, maxBatchSize: 1 }),
        executionWindow(),
        RateLimitProfile.create({ maxPerDay: 1, maxPerHour: 1, maxPerCompanyPerWindow: 1 }),
        Actor.candidate(OWNER_ID),
        correlationId(),
      );
      campaign.addTarget('job-1', 'company-1', Actor.candidate(OWNER_ID), correlationId());
      campaign.addTarget('job-2', 'company-2', Actor.candidate(OWNER_ID), correlationId());
      campaign.markReady(Actor.candidate(OWNER_ID), correlationId());
      campaign.start(Actor.candidate(OWNER_ID), correlationId());

      const firstBatch = campaign.planNextBatch(Actor.system('scheduler'), correlationId(), new Date());
      campaign.dispatchTarget(firstBatch.targetIds[0], Actor.system('dispatcher'), correlationId());

      // dispatchTarget() timestamps its DispatchAttempt with the real wall clock, not an
      // injected `now` — derive the rate-limit check's `now` from that actual attempt instead
      // of a separately-captured `new Date()`, so the two can never race against each other.
      const dispatchedAt = campaign.targets[0].dispatchAttempts[0].attemptedAt;
      const checkNow = new Date(dispatchedAt.getTime() + 1_000);

      expect(() => campaign.planNextBatch(Actor.system('scheduler'), correlationId(), checkNow)).toThrow(
        /Rate limit exceeded/,
      );
    });

    it('addTarget excludes (rather than rejects) a target whose company is fatigued, and raises CompanyFatigueDetected', () => {
      const campaign = createCampaign();
      campaign.recordCompanyInteraction(
        'fatigued-company',
        { coolingDownUntil: new Date(Date.now() + 60_000) },
        Actor.system('fatigue-monitor'),
        correlationId(),
      );
      campaign.clearDomainEvents();

      const target = campaign.addTarget('job-1', 'fatigued-company', Actor.candidate(OWNER_ID), correlationId());

      expect(target.status).toBe('EXCLUDED');
      expect(campaign.domainEvents.some((event) => event.constructor.name === 'CompanyFatigueDetected')).toBe(true);
      expect(campaign.domainEvents.some((event) => event.constructor.name === 'CampaignTargetAdded')).toBe(false);
    });
  });
});
