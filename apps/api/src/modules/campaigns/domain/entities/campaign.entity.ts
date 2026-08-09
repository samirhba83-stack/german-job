import { randomUUID } from 'crypto';
import {
  CampaignStatus,
  CampaignTargetStatus,
  DispatchOutcome,
  ReplayScope,
} from '@german-job-engine/shared-types';
import { AggregateRoot } from '../../../../shared/domain';
import { CampaignName } from '../value-objects/campaign-name.vo';
import { CampaignGoal } from '../value-objects/campaign-goal.vo';
import { CampaignStrategyProfile } from '../value-objects/campaign-strategy-profile.vo';
import { SmartBatchPlan } from '../value-objects/smart-batch-plan.vo';
import { ExecutionWindow } from '../value-objects/execution-window.vo';
import { RateLimitProfile } from '../value-objects/rate-limit-profile.vo';
import { AdaptiveSpeedProfile } from '../value-objects/adaptive-speed-profile.vo';
import { CampaignHealth } from '../value-objects/campaign-health.vo';
import { CampaignIntelligence } from '../value-objects/campaign-intelligence.vo';
import { Actor } from '../value-objects/actor.vo';
import { CorrelationId } from '../value-objects/correlation-id.vo';
import { CampaignReason } from '../value-objects/campaign-reason.vo';
import { Metadata } from '../value-objects/metadata.vo';
import { EvidenceReference } from '../value-objects/evidence-reference.vo';
import { CooldownPeriod } from '../value-objects/cooldown-period.vo';
import { Checkpoint } from '../value-objects/checkpoint.vo';
import { Timeline } from './timeline';
import { CampaignTimelineEntry } from './campaign-timeline-entry.entity';
import { CampaignTarget } from './campaign-target.entity';
import { Batch } from './batch.entity';
import { CompanyMemoryEntry } from './company-memory-entry.entity';
import { DispatchAttempt } from './dispatch-attempt.entity';
import { CanTransitionSpecification } from '../specifications/can-transition.specification';
import { ReadinessPolicy } from '../policies/readiness.policy';
import { StartPolicy } from '../policies/start.policy';
import { PausePolicy } from '../policies/pause.policy';
import { CooldownPolicy } from '../policies/cooldown.policy';
import { ResumePolicy } from '../policies/resume.policy';
import { CompletionPolicy } from '../policies/completion.policy';
import { StopPolicy } from '../policies/stop.policy';
import { CancelPolicy } from '../policies/cancel.policy';
import { ArchivePolicy } from '../policies/archive.policy';
import { DuplicateDetectionPolicy } from '../policies/duplicate-detection.policy';
import { CompanyFatiguePolicy } from '../policies/company-fatigue.policy';
import { RateLimitPolicy } from '../policies/rate-limit.policy';
import { ExecutionWindowPolicy } from '../policies/execution-window.policy';
import { RetryPolicy } from '../policies/retry.policy';
import { ReplayPolicy } from '../policies/replay.policy';
import { CampaignLifecyclePolicy } from '../policies/campaign-policy.interface';
import { InvalidCampaignStatusTransitionException } from '../exceptions/invalid-campaign-status-transition.exception';
import { UnauthorizedCampaignActionException } from '../exceptions/unauthorized-campaign-action.exception';
import { MissingCampaignReasonException } from '../exceptions/missing-campaign-reason.exception';
import { CampaignNotEditableException } from '../exceptions/campaign-not-editable.exception';
import { MissingCampaignTargetException } from '../exceptions/missing-campaign-target.exception';
import { MissingCheckpointException } from '../exceptions/missing-checkpoint.exception';
import { DuplicateCampaignTargetException } from '../exceptions/duplicate-campaign-target.exception';
import { RateLimitExceededException } from '../exceptions/rate-limit-exceeded.exception';
import { ExecutionWindowClosedException } from '../exceptions/execution-window-closed.exception';
import { CampaignTargetNotFoundException } from '../exceptions/campaign-target-not-found.exception';
import { CampaignBatchNotFoundException } from '../exceptions/campaign-batch-not-found.exception';
import { CampaignCreated } from '../events/campaign-created.event';
import { CampaignReadied } from '../events/campaign-readied.event';
import { CampaignStarted } from '../events/campaign-started.event';
import { CampaignPaused } from '../events/campaign-paused.event';
import { CampaignResumed } from '../events/campaign-resumed.event';
import { CampaignResumeConfirmed } from '../events/campaign-resume-confirmed.event';
import { CampaignCompleted } from '../events/campaign-completed.event';
import { CampaignStopped } from '../events/campaign-stopped.event';
import { CampaignCancelled } from '../events/campaign-cancelled.event';
import { CampaignArchived } from '../events/campaign-archived.event';
import { CampaignTransitioned } from '../events/campaign-transitioned.event';
import { CampaignLifecycleEvent } from '../events/campaign-lifecycle.event';
import { CampaignTargetAdded } from '../events/campaign-target-added.event';
import { BatchStarted } from '../events/batch-started.event';
import { BatchCompleted } from '../events/batch-completed.event';
import { BatchPartiallyCompleted } from '../events/batch-partially-completed.event';
import { ApplicationQueued } from '../events/application-queued.event';
import { ApplicationDispatched } from '../events/application-dispatched.event';
import { ApplicationSkipped } from '../events/application-skipped.event';
import { ApplicationExcluded } from '../events/application-excluded.event';
import { ApplicationFailed } from '../events/application-failed.event';
import { RetryScheduled } from '../events/retry-scheduled.event';
import { RetryExhausted } from '../events/retry-exhausted.event';
import { ReplayStarted } from '../events/replay-started.event';
import { ReplayCompleted } from '../events/replay-completed.event';
import { CheckpointSaved } from '../events/checkpoint-saved.event';
import { CooldownStarted } from '../events/cooldown-started.event';
import { CooldownFinished } from '../events/cooldown-finished.event';
import { CampaignHealthChanged } from '../events/campaign-health-changed.event';
import { CampaignStrategyChanged } from '../events/campaign-strategy-changed.event';
import { DynamicGoalAdjusted } from '../events/dynamic-goal-adjusted.event';
import { CampaignUpdated } from '../events/campaign-updated.event';
import { DynamicGoalReached } from '../events/dynamic-goal-reached.event';
import { CompanyMemoryUpdated } from '../events/company-memory-updated.event';
import { CompanyFatigueDetected } from '../events/company-fatigue-detected.event';

const S = CampaignStatus;

export interface CampaignProps {
  ownerId: string;
  name: CampaignName;
  status: CampaignStatus;
  strategy: CampaignStrategyProfile;
  goal: CampaignGoal;
  batchPlan: SmartBatchPlan;
  executionWindow: ExecutionWindow;
  rateLimitProfile: RateLimitProfile;
  adaptiveSpeedProfile: AdaptiveSpeedProfile | null;
  targets: CampaignTarget[];
  batches: Batch[];
  companyMemory: CompanyMemoryEntry[];
  checkpoint: Checkpoint | null;
  cooldown: CooldownPeriod | null;
  timeline: Timeline;
  health: CampaignHealth | null;
  intelligence: CampaignIntelligence | null;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}

/** Not fully terminal — STOPPED -> RESUMING is allowed, unlike Cancelled/Completed/Archived. */
const TERMINAL_STATES: ReadonlyArray<CampaignStatus> = [S.COMPLETED, S.CANCELLED, S.ARCHIVED];

const EDITABLE_STATES: ReadonlyArray<CampaignStatus> = [S.DRAFT, S.READY];
const STRATEGY_CHANGEABLE_STATES: ReadonlyArray<CampaignStatus> = [S.DRAFT, S.READY, S.PAUSED];

export class Campaign extends AggregateRoot<string> {
  private props: CampaignProps;
  private readonly _version: number;

  /**
   * `_version` is deliberately kept outside CampaignProps — it is a persistence-layer
   * concurrency token, not a business property, and is never mutated in memory. The
   * repository's save() does the actual compare-and-increment; the aggregate only carries the
   * value it was loaded with so the repository has something to compare against.
   */
  private constructor(id: string, props: CampaignProps, version: number) {
    super(id);

    if (!props.ownerId) {
      throw new Error('A campaign cannot exist without an owner');
    }

    this.props = props;
    this._version = version;
  }

  get version(): number {
    return this._version;
  }

  get ownerId(): string {
    return this.props.ownerId;
  }

  get name(): CampaignName {
    return this.props.name;
  }

  get status(): CampaignStatus {
    return this.props.status;
  }

  get strategy(): CampaignStrategyProfile {
    return this.props.strategy;
  }

  get goal(): CampaignGoal {
    return this.props.goal;
  }

  get batchPlan(): SmartBatchPlan {
    return this.props.batchPlan;
  }

  get executionWindow(): ExecutionWindow {
    return this.props.executionWindow;
  }

  get rateLimitProfile(): RateLimitProfile {
    return this.props.rateLimitProfile;
  }

  get adaptiveSpeedProfile(): AdaptiveSpeedProfile | null {
    return this.props.adaptiveSpeedProfile;
  }

  get targets(): ReadonlyArray<CampaignTarget> {
    return this.props.targets;
  }

  get batches(): ReadonlyArray<Batch> {
    return this.props.batches;
  }

  get companyMemory(): ReadonlyArray<CompanyMemoryEntry> {
    return this.props.companyMemory;
  }

  get checkpoint(): Checkpoint | null {
    return this.props.checkpoint;
  }

  get cooldown(): CooldownPeriod | null {
    return this.props.cooldown;
  }

  get timeline(): Timeline {
    return this.props.timeline;
  }

  get health(): CampaignHealth | null {
    return this.props.health;
  }

  get intelligence(): CampaignIntelligence | null {
    return this.props.intelligence;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get startedAt(): Date | null {
    return this.props.startedAt;
  }

  get completedAt(): Date | null {
    return this.props.completedAt;
  }

  isTerminal(): boolean {
    return TERMINAL_STATES.includes(this.props.status);
  }

  isActive(): boolean {
    return !this.isTerminal();
  }

  canTransitionTo(target: CampaignStatus): boolean {
    return CanTransitionSpecification.isSatisfiedBy(this.props.status, target);
  }

  isOwnedBy(actorId: string | null): boolean {
    return actorId !== null && this.props.ownerId === actorId;
  }

  findTarget(targetId: string): CampaignTarget | null {
    return this.props.targets.find((target) => target.id === targetId) ?? null;
  }

  findBatch(batchId: string): Batch | null {
    return this.props.batches.find((batch) => batch.id === batchId) ?? null;
  }

  findCompanyMemory(companyId: string): CompanyMemoryEntry | null {
    return this.props.companyMemory.find((entry) => entry.companyId === companyId) ?? null;
  }

  /** Rolling 24h count of successful dispatches, as of `now`. Backs RateLimitPolicy checks both
   * here (planNextBatch) and in the Scheduler's eligibility evaluation (Phase 4 M3). */
  dispatchedInLast24Hours(now: Date): number {
    const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return this.props.targets.reduce((count, target) => {
      const recentSuccesses = target.dispatchAttempts.filter(
        (attempt) => attempt.outcome === DispatchOutcome.SUCCEEDED && attempt.attemptedAt >= windowStart && attempt.attemptedAt <= now,
      ).length;
      return count + recentSuccesses;
    }, 0);
  }

  /** Registers a brand-new Campaign in DRAFT and raises CampaignCreated + CampaignTransitioned. */
  static create(
    id: string,
    ownerId: string,
    name: CampaignName,
    goal: CampaignGoal,
    strategy: CampaignStrategyProfile,
    batchPlan: SmartBatchPlan,
    executionWindow: ExecutionWindow,
    rateLimitProfile: RateLimitProfile,
    actor: Actor,
    correlationId: CorrelationId,
  ): Campaign {
    const now = new Date();
    const campaign = new Campaign(
      id,
      {
        ownerId,
        name,
        status: S.DRAFT,
        strategy,
        goal,
        batchPlan,
        executionWindow,
        rateLimitProfile,
        adaptiveSpeedProfile: null,
        targets: [],
        batches: [],
        companyMemory: [],
        checkpoint: null,
        cooldown: null,
        timeline: Timeline.empty(),
        health: null,
        intelligence: null,
        createdAt: now,
        updatedAt: now,
        startedAt: null,
        completedAt: null,
      },
      0,
    );

    const entry = CampaignTimelineEntry.create(randomUUID(), {
      timestamp: now,
      actor,
      source: 'campaign-creation',
      reason: null,
      previousState: null,
      currentState: S.DRAFT,
      metadata: Metadata.empty(),
      correlationId,
      evidenceReference: null,
      aiExplanation: null,
    });
    campaign.props.timeline = campaign.props.timeline.append(entry);

    campaign.addDomainEvent(new CampaignCreated(id, correlationId.value, S.DRAFT, actor, name, goal));
    campaign.addDomainEvent(new CampaignTransitioned(id, correlationId.value, null, S.DRAFT, actor));
    return campaign;
  }

  /** Rehydrates a Campaign from persistence without re-raising domain events. `version` defaults
   * to 0 for callers (existing tests) that predate optimistic concurrency. */
  static reconstitute(id: string, props: CampaignProps, version: number = 0): Campaign {
    return new Campaign(id, props, version);
  }

  // ---------------------------------------------------------------------
  // Editing (DRAFT / READY only)
  // ---------------------------------------------------------------------

  update(
    fields: {
      name?: CampaignName;
      goal?: CampaignGoal;
      strategy?: CampaignStrategyProfile;
      batchPlan?: SmartBatchPlan;
      executionWindow?: ExecutionWindow;
      rateLimitProfile?: RateLimitProfile;
    },
    actor: Actor,
    correlationId: CorrelationId,
  ): void {
    if (!EDITABLE_STATES.includes(this.props.status)) {
      throw new CampaignNotEditableException(this.props.status);
    }

    const changedFields: string[] = [];

    if (fields.name) {
      this.props.name = fields.name;
      changedFields.push('name');
    }
    if (fields.goal && !fields.goal.equals(this.props.goal)) {
      const previousGoal = this.props.goal;
      this.props.goal = fields.goal;
      this.addDomainEvent(
        new DynamicGoalAdjusted(this.id, correlationId.value, actor, previousGoal, fields.goal),
      );
    }
    if (fields.strategy && !fields.strategy.equals(this.props.strategy)) {
      const previousStrategy = this.props.strategy;
      this.props.strategy = fields.strategy;
      this.addDomainEvent(
        new CampaignStrategyChanged(this.id, correlationId.value, actor, previousStrategy, fields.strategy),
      );
    }
    if (fields.batchPlan) {
      this.props.batchPlan = fields.batchPlan;
      changedFields.push('batchPlan');
    }
    if (fields.executionWindow) {
      this.props.executionWindow = fields.executionWindow;
      changedFields.push('executionWindow');
    }
    if (fields.rateLimitProfile) {
      this.props.rateLimitProfile = fields.rateLimitProfile;
      changedFields.push('rateLimitProfile');
    }

    if (changedFields.length > 0) {
      this.addDomainEvent(new CampaignUpdated(this.id, correlationId.value, actor, changedFields));
    }

    this.touch();
  }

  changeStrategy(newStrategy: CampaignStrategyProfile, actor: Actor, correlationId: CorrelationId): void {
    if (!STRATEGY_CHANGEABLE_STATES.includes(this.props.status)) {
      throw new CampaignNotEditableException(this.props.status);
    }
    const previousStrategy = this.props.strategy;
    this.props.strategy = newStrategy;
    this.touch();
    this.addDomainEvent(new CampaignStrategyChanged(this.id, correlationId.value, actor, previousStrategy, newStrategy));
  }

  adjustGoal(newGoal: CampaignGoal, actor: Actor, correlationId: CorrelationId): void {
    if (this.isTerminal()) {
      throw new CampaignNotEditableException(this.props.status);
    }
    const previousGoal = this.props.goal;
    this.props.goal = newGoal;
    this.touch();
    this.addDomainEvent(new DynamicGoalAdjusted(this.id, correlationId.value, actor, previousGoal, newGoal));
  }

  // ---------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------

  /**
   * A duplicate target is refused outright (nothing worth recording — it was never a real
   * candidate for this campaign). A fatigued company is different: the target is still added,
   * just immediately EXCLUDED, and CompanyFatigueDetected is raised — that event previously
   * existed but could never actually fire, because raising it on a path that then throws means
   * the command's save-and-publish step is never reached. Excluding-not-rejecting makes the
   * signal genuinely observable in the Timeline instead of a no-op. Safe to change now: this
   * method has zero live callers as of Phase 4 M1.
   */
  addTarget(jobId: string, companyId: string, actor: Actor, correlationId: CorrelationId): CampaignTarget {
    const duplicateDecision = new DuplicateDetectionPolicy().authorize(
      jobId,
      companyId,
      this.props.targets,
      this.findCompanyMemory(companyId),
    );
    if (!duplicateDecision.allowed) {
      throw new DuplicateCampaignTargetException(jobId);
    }

    const target = CampaignTarget.create(randomUUID(), jobId, companyId);
    this.props.targets = [...this.props.targets, target];
    this.touch();

    const fatigueDecision = new CompanyFatiguePolicy().authorize(this.findCompanyMemory(companyId));
    if (!fatigueDecision.allowed) {
      target.markExcluded();
      this.addDomainEvent(new CompanyFatigueDetected(this.id, correlationId.value, actor, companyId));
      return target;
    }

    this.addDomainEvent(new CampaignTargetAdded(this.id, correlationId.value, actor, target.id, jobId, companyId));
    return target;
  }

  markReady(actor: Actor, correlationId: CorrelationId, reason?: CampaignReason): void {
    this.requireAtLeastOneTarget();
    const target = S.READY;
    this.guard(target, new ReadinessPolicy(), actor);
    const previous = this.applyTransition(target, actor, correlationId, reason ?? null, 'lifecycle');
    this.raiseLifecycle(new CampaignReadied(this.id, correlationId.value, previous, target, actor), correlationId, previous, target, actor);
  }

  start(actor: Actor, correlationId: CorrelationId): void {
    const target = S.RUNNING;
    this.guard(target, new StartPolicy(), actor);
    const previous = this.applyTransition(target, actor, correlationId, null, 'lifecycle');
    this.props.startedAt = this.props.updatedAt;
    this.raiseLifecycle(
      new CampaignStarted(this.id, correlationId.value, previous, target, actor, this.props.startedAt),
      correlationId,
      previous,
      target,
      actor,
    );
  }

  pause(actor: Actor, correlationId: CorrelationId, reason?: CampaignReason): void {
    const target = S.PAUSED;
    this.guard(target, new PausePolicy(), actor);
    const previous = this.applyTransition(target, actor, correlationId, reason ?? null, 'lifecycle');
    this.raiseLifecycle(new CampaignPaused(this.id, correlationId.value, previous, target, actor), correlationId, previous, target, actor);
  }

  enterCooldown(actor: Actor, correlationId: CorrelationId, cooldown: CooldownPeriod, reason?: CampaignReason): void {
    const target = S.COOLING_DOWN;
    this.guard(target, new CooldownPolicy(), actor);
    const previous = this.applyTransition(target, actor, correlationId, reason ?? null, 'fatigue-monitor');
    this.props.cooldown = cooldown;
    this.addDomainEvent(new CooldownStarted(this.id, correlationId.value, actor, cooldown));
    this.raiseLifecycle(
      new CampaignTransitioned(this.id, correlationId.value, previous, target, actor),
      correlationId,
      previous,
      target,
      actor,
    );
  }

  resume(actor: Actor, correlationId: CorrelationId, reason?: CampaignReason): void {
    const target = S.RESUMING;
    this.guard(target, new ResumePolicy(), actor);
    const wasCoolingDown = this.props.status === S.COOLING_DOWN;
    const previous = this.applyTransition(target, actor, correlationId, reason ?? null, 'lifecycle');
    if (wasCoolingDown) {
      this.props.cooldown = null;
      this.addDomainEvent(new CooldownFinished(this.id, correlationId.value, actor));
    }
    this.raiseLifecycle(new CampaignResumed(this.id, correlationId.value, previous, target, actor), correlationId, previous, target, actor);
  }

  confirmResume(actor: Actor, correlationId: CorrelationId): void {
    const target = S.RUNNING;
    this.guard(target, new ResumePolicy(), actor);
    if (this.props.batches.length > 0 && !this.props.checkpoint) {
      throw new MissingCheckpointException();
    }
    const previous = this.applyTransition(target, actor, correlationId, null, 'lifecycle');
    this.raiseLifecycle(
      new CampaignResumeConfirmed(this.id, correlationId.value, previous, target, actor),
      correlationId,
      previous,
      target,
      actor,
    );
  }

  complete(actor: Actor, correlationId: CorrelationId): void {
    const target = S.COMPLETED;
    this.guard(target, new CompletionPolicy(), actor);
    const previous = this.applyTransition(target, actor, correlationId, null, 'lifecycle');
    this.props.completedAt = this.props.updatedAt;
    this.raiseLifecycle(
      new CampaignCompleted(this.id, correlationId.value, previous, target, actor, this.props.completedAt),
      correlationId,
      previous,
      target,
      actor,
    );
  }

  stop(actor: Actor, correlationId: CorrelationId, reason: CampaignReason): void {
    const target = S.STOPPED;
    this.guard(target, new StopPolicy(), actor);
    this.requireReason('stop', reason);
    const previous = this.applyTransition(target, actor, correlationId, reason, 'lifecycle');
    this.raiseLifecycle(
      new CampaignStopped(this.id, correlationId.value, previous, target, actor, reason),
      correlationId,
      previous,
      target,
      actor,
    );
  }

  cancel(actor: Actor, correlationId: CorrelationId, reason: CampaignReason): void {
    const target = S.CANCELLED;
    this.guard(target, new CancelPolicy(), actor);
    this.requireReason('cancel', reason);
    const previous = this.applyTransition(target, actor, correlationId, reason, 'lifecycle');
    this.raiseLifecycle(
      new CampaignCancelled(this.id, correlationId.value, previous, target, actor, reason),
      correlationId,
      previous,
      target,
      actor,
    );
  }

  archive(actor: Actor, correlationId: CorrelationId, reason?: CampaignReason): void {
    const target = S.ARCHIVED;
    this.guard(target, new ArchivePolicy(), actor);
    const previous = this.applyTransition(target, actor, correlationId, reason ?? null, 'lifecycle');
    this.raiseLifecycle(new CampaignArchived(this.id, correlationId.value, previous, target, actor), correlationId, previous, target, actor);
  }

  // ---------------------------------------------------------------------
  // Batch execution
  // ---------------------------------------------------------------------

  planNextBatch(actor: Actor, correlationId: CorrelationId, now: Date = new Date()): Batch {
    this.requireRunning();

    const windowDecision = new ExecutionWindowPolicy().authorize(this.props.executionWindow, now);
    if (!windowDecision.allowed) {
      throw new ExecutionWindowClosedException(windowDecision.explanation);
    }

    const pending = this.props.targets.filter((target) => target.status === CampaignTargetStatus.PENDING);
    const size = Math.min(pending.length, this.props.batchPlan.baseBatchSize);

    const rateLimitDecision = new RateLimitPolicy().authorize(size, this.dispatchedInLast24Hours(now), this.props.rateLimitProfile);
    if (!rateLimitDecision.allowed) {
      throw new RateLimitExceededException(rateLimitDecision.explanation);
    }

    const selected = pending.slice(0, size);

    const batch = Batch.create(randomUUID(), selected.map((target) => target.id));
    this.props.batches = [...this.props.batches, batch];

    for (const target of selected) {
      target.markQueued();
      this.addDomainEvent(
        new ApplicationQueued(this.id, correlationId.value, actor, target.id, target.jobId, target.companyId),
      );
    }

    this.touch();
    this.addDomainEvent(new BatchStarted(this.id, correlationId.value, actor, batch.id, batch.targetIds));
    return batch;
  }

  completeBatch(batchId: string, actor: Actor, correlationId: CorrelationId): void {
    this.requireRunning();

    const batch = this.findBatch(batchId);
    if (!batch) {
      throw new CampaignBatchNotFoundException(batchId);
    }

    const batchTargets = batch.targetIds
      .map((targetId) => this.findTarget(targetId))
      .filter((target): target is CampaignTarget => target !== null);
    const allDispatched = batchTargets.every((target) => target.status === CampaignTargetStatus.DISPATCHED);

    if (allDispatched) {
      batch.complete();
      this.addDomainEvent(new BatchCompleted(this.id, correlationId.value, actor, batch.id));
    } else {
      batch.completePartially();
      this.addDomainEvent(new BatchPartiallyCompleted(this.id, correlationId.value, actor, batch.id));
    }

    const checkpoint = Checkpoint.create({ lastCompletedBatchId: batch.id, cursorPosition: this.props.batches.indexOf(batch) + 1 });
    this.props.checkpoint = checkpoint;
    this.addDomainEvent(new CheckpointSaved(this.id, correlationId.value, actor, checkpoint));

    this.touch();
    this.checkGoalReached(actor, correlationId);
  }

  dispatchTarget(
    targetId: string,
    actor: Actor,
    correlationId: CorrelationId,
    evidenceReference: EvidenceReference | null = null,
  ): void {
    this.requireRunning();

    const target = this.findTarget(targetId);
    if (!target) {
      throw new CampaignTargetNotFoundException(targetId);
    }

    const attempt = DispatchAttempt.create(randomUUID(), {
      attemptNumber: target.dispatchAttempts.length + 1,
      attemptedAt: new Date(),
      outcome: DispatchOutcome.SUCCEEDED,
      failureReason: null,
      evidenceReference,
    });
    target.markDispatched(attempt);
    this.touch();

    this.addDomainEvent(
      new ApplicationDispatched(this.id, correlationId.value, actor, target.id, target.jobId, target.companyId, evidenceReference),
    );

    this.recordCompanyInteraction(target.companyId, { alreadyApplied: true }, actor, correlationId);
  }

  skipTarget(targetId: string, reason: CampaignReason, actor: Actor, correlationId: CorrelationId): void {
    this.requireRunning();

    const target = this.findTarget(targetId);
    if (!target) {
      throw new CampaignTargetNotFoundException(targetId);
    }
    target.markSkipped();
    this.touch();
    this.addDomainEvent(new ApplicationSkipped(this.id, correlationId.value, actor, target.id, reason));
  }

  /** M30 Phase 4/5 — the real, additive enforcement point for follow-up suppression: called from
   * `CampaignBatchDispatchService.dispatchOneTarget()` immediately before the real provider send,
   * in place of dispatching, whenever `FollowUpEligibilityService` reports the target's
   * application is not currently eligible. Deliberately distinct from `skipTarget()` — an
   * exclusion is never a generic skip or a delivery failure (Non-Negotiable Principle #8: never
   * represent a deliberate decision as a failure). Like `skipTarget()`, this only ever runs on a
   * target that has not yet been marked DISPATCHED in this same call — `CampaignTarget.
   * markExcluded()` is exactly as unconditional as `markSkipped()`, so calling this on an
   * already-dispatched target would corrupt real send history; the one real call site never does. */
  excludeTarget(targetId: string, reason: CampaignReason, actor: Actor, correlationId: CorrelationId): void {
    this.requireRunning();

    const target = this.findTarget(targetId);
    if (!target) {
      throw new CampaignTargetNotFoundException(targetId);
    }
    target.markExcluded();
    this.touch();
    this.addDomainEvent(new ApplicationExcluded(this.id, correlationId.value, actor, target.id, reason));
  }

  recordTargetFailure(targetId: string, failureReason: string | null, actor: Actor, correlationId: CorrelationId): void {
    this.requireRunning();

    const target = this.findTarget(targetId);
    if (!target) {
      throw new CampaignTargetNotFoundException(targetId);
    }

    const attempt = DispatchAttempt.create(randomUUID(), {
      attemptNumber: target.dispatchAttempts.length + 1,
      attemptedAt: new Date(),
      outcome: DispatchOutcome.FAILED,
      failureReason,
      evidenceReference: null,
    });
    target.recordFailedAttempt(attempt);
    target.markFailed();
    this.touch();
    this.addDomainEvent(new ApplicationFailed(this.id, correlationId.value, actor, target.id, failureReason));
  }

  // ---------------------------------------------------------------------
  // Retry & replay
  // ---------------------------------------------------------------------

  retryFailedTargets(actor: Actor, correlationId: CorrelationId, maxAttempts?: number): void {
    const failedTargets = this.props.targets.filter((target) => target.status === CampaignTargetStatus.FAILED);
    const retryPolicy = new RetryPolicy();

    for (const target of failedTargets) {
      const decision = retryPolicy.authorize(target.dispatchAttempts.length, maxAttempts);
      if (decision.allowed) {
        target.resetForRetry();
        this.addDomainEvent(
          new RetryScheduled(this.id, correlationId.value, actor, target.id, target.dispatchAttempts.length),
        );
      } else {
        this.addDomainEvent(
          new RetryExhausted(this.id, correlationId.value, actor, target.id, target.dispatchAttempts.length),
        );
      }
    }

    this.touch();
  }

  replay(scope: ReplayScope, actor: Actor, correlationId: CorrelationId, targetIds?: string[]): void {
    const candidates =
      scope === ReplayScope.SPECIFIC_TARGETS && targetIds
        ? this.props.targets.filter((target) => targetIds.includes(target.id))
        : this.props.targets;

    const eligible = new ReplayPolicy().eligibleTargets(candidates);
    for (const target of eligible) {
      target.resetForRetry();
    }

    this.touch();
    this.addDomainEvent(
      new ReplayStarted(this.id, correlationId.value, actor, scope, eligible.map((target) => target.id)),
    );
    this.addDomainEvent(new ReplayCompleted(this.id, correlationId.value, actor, scope));
  }

  // ---------------------------------------------------------------------
  // Company memory
  // ---------------------------------------------------------------------

  recordCompanyInteraction(
    companyId: string,
    updates: Parameters<CompanyMemoryEntry['recordInteraction']>[0],
    actor: Actor,
    correlationId: CorrelationId,
  ): void {
    let entry = this.findCompanyMemory(companyId);
    if (!entry) {
      entry = CompanyMemoryEntry.createEmpty(companyId);
      this.props.companyMemory = [...this.props.companyMemory, entry];
    }
    entry.recordInteraction(updates);
    this.touch();
    this.addDomainEvent(new CompanyMemoryUpdated(this.id, correlationId.value, actor, companyId));
  }

  // ---------------------------------------------------------------------
  // Reserved intelligence hooks
  // ---------------------------------------------------------------------

  /** Raises CampaignHealthChanged — unlike Intelligence, Health assessments are observable. */
  recordHealthAssessment(health: CampaignHealth, actor: Actor, correlationId: CorrelationId): void {
    this.props.health = health;
    this.touch();
    this.addDomainEvent(new CampaignHealthChanged(this.id, correlationId.value, actor, health));
  }

  /** Silent attach — mirrors the Application Lifecycle Engine's recordIntelligenceAssessment. */
  recordIntelligenceAssessment(intelligence: CampaignIntelligence, _actor: Actor): void {
    this.props.intelligence = intelligence;
    this.touch();
  }

  /** Silent attach — reserved, nothing in the domain reads these factors. */
  recordAdaptiveSpeedAssessment(profile: AdaptiveSpeedProfile, _actor: Actor): void {
    this.props.adaptiveSpeedProfile = profile;
    this.touch();
  }

  // ---------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------

  private requireAtLeastOneTarget(): void {
    if (this.props.targets.length === 0) {
      throw new MissingCampaignTargetException();
    }
  }

  /** Shared guard for every batch/dispatch operation — protects the aggregate's own invariant
   * (nothing should mutate targets/batches once the campaign has left RUNNING) instead of
   * relying on every caller, including leftover in-flight jobs from before a pause/cancel, to
   * check first. */
  private requireRunning(): void {
    if (this.props.status !== S.RUNNING) {
      throw new InvalidCampaignStatusTransitionException(this.props.status, this.props.status);
    }
  }

  private requireReason(action: string, reason: CampaignReason | undefined): asserts reason is CampaignReason {
    if (!reason) {
      throw new MissingCampaignReasonException(action);
    }
  }

  private checkGoalReached(actor: Actor, correlationId: CorrelationId): void {
    const dispatchedCount = this.props.targets.filter((target) => target.status === CampaignTargetStatus.DISPATCHED).length;
    if (dispatchedCount >= this.props.goal.targetApplicationCount) {
      this.addDomainEvent(new DynamicGoalReached(this.id, correlationId.value, actor, this.props.goal));
    }
  }

  private guard(target: CampaignStatus, policy: CampaignLifecyclePolicy, actor: Actor): void {
    if (!CanTransitionSpecification.isSatisfiedBy(this.props.status, target)) {
      throw new InvalidCampaignStatusTransitionException(this.props.status, target);
    }

    const decision = policy.authorize({
      actor,
      ownerId: this.props.ownerId,
      currentState: this.props.status,
      targetState: target,
    });
    if (!decision.allowed) {
      throw new UnauthorizedCampaignActionException(decision.explanation);
    }
  }

  private applyTransition(
    target: CampaignStatus,
    actor: Actor,
    correlationId: CorrelationId,
    reason: CampaignReason | null,
    source: string,
  ): CampaignStatus {
    const previousState = this.props.status;
    this.props.status = target;
    this.touch();

    const entry = CampaignTimelineEntry.create(randomUUID(), {
      timestamp: this.props.updatedAt,
      actor,
      source,
      reason,
      previousState,
      currentState: target,
      metadata: Metadata.empty(),
      correlationId,
      evidenceReference: null,
      aiExplanation: null,
    });
    this.props.timeline = this.props.timeline.append(entry);

    return previousState;
  }

  private raiseLifecycle(
    specificEvent: CampaignLifecycleEvent,
    correlationId: CorrelationId,
    previous: CampaignStatus,
    current: CampaignStatus,
    actor: Actor,
  ): void {
    this.addDomainEvent(specificEvent);
    this.addDomainEvent(new CampaignTransitioned(this.id, correlationId.value, previous, current, actor));
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }
}
