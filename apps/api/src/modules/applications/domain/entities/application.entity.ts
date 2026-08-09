import { randomUUID } from 'crypto';
import { ApplicationLifecycleStatus } from '@german-job-engine/shared-types';
import { AggregateRoot } from '../../../../shared/domain';
import { ApplicationId } from '../value-objects/application-id.vo';
import { ApplicationSnapshot } from '../value-objects/application-snapshot.vo';
import { ApplicationChannel } from '../value-objects/application-channel.vo';
import { Actor } from '../value-objects/actor.vo';
import { TransitionReason } from '../value-objects/transition-reason.vo';
import { CorrelationId } from '../value-objects/correlation-id.vo';
import { EvidenceReference } from '../value-objects/evidence-reference.vo';
import { ConfidenceScore } from '../value-objects/confidence-score.vo';
import { Metadata } from '../value-objects/metadata.vo';
import { ApplicationIntelligence } from '../value-objects/application-intelligence.vo';
import { Timeline } from './timeline';
import { TimelineEntry } from './timeline-entry.entity';
import { CanTransitionSpecification } from '../specifications/can-transition.specification';
import { ReadinessPolicy } from '../policies/readiness.policy';
import { SchedulingPolicy } from '../policies/scheduling.policy';
import { DispatchPolicy } from '../policies/dispatch.policy';
import { TrackingSignalPolicy } from '../policies/tracking-signal.policy';
import { ResponsePolicy } from '../policies/response.policy';
import { InterviewPolicy } from '../policies/interview.policy';
import { OfferPolicy } from '../policies/offer.policy';
import { ContractPolicy } from '../policies/contract.policy';
import { RejectionPolicy } from '../policies/rejection.policy';
import { WithdrawalPolicy } from '../policies/withdrawal.policy';
import { ArchivalPolicy } from '../policies/archival.policy';
import { ApplicationPolicy } from '../policies/application-policy.interface';
import { InvalidApplicationStatusTransitionException } from '../exceptions/invalid-application-status-transition.exception';
import { UnauthorizedApplicationActionException } from '../exceptions/unauthorized-application-action.exception';
import { MissingTransitionReasonException } from '../exceptions/missing-transition-reason.exception';
import { MissingTrackingEvidenceException } from '../exceptions/missing-tracking-evidence.exception';
import { ApplicationCreated } from '../events/application-created.event';
import { ApplicationPrepared } from '../events/application-prepared.event';
import { ApplicationQueued } from '../events/application-queued.event';
import { ApplicationSent } from '../events/application-sent.event';
import { ApplicationDelivered } from '../events/application-delivered.event';
import { ApplicationOpened } from '../events/application-opened.event';
import { ApplicationViewed } from '../events/application-viewed.event';
import { CompanyReplied } from '../events/company-replied.event';
import { InterviewScheduled } from '../events/interview-scheduled.event';
import { InterviewCompleted } from '../events/interview-completed.event';
import { OfferReceived } from '../events/offer-received.event';
import { ContractSigned } from '../events/contract-signed.event';
import { ApplicationRejected } from '../events/application-rejected.event';
import { ApplicationWithdrawn } from '../events/application-withdrawn.event';
import { ApplicationArchived } from '../events/application-archived.event';
import { ApplicationTransitioned } from '../events/application-transitioned.event';
import { ApplicationLifecycleEvent } from '../events/application-lifecycle.event';

const S = ApplicationLifecycleStatus;

export interface ApplicationProps {
  candidateId: string;
  jobId: string;
  companyId: string;
  status: ApplicationLifecycleStatus;
  snapshot: ApplicationSnapshot;
  channel: ApplicationChannel;
  timeline: Timeline;
  intelligence: ApplicationIntelligence | null;
  submittedAt: Date | null;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TERMINAL_STATES: ReadonlyArray<ApplicationLifecycleStatus> = [
  S.REJECTED,
  S.WITHDRAWN,
  S.ARCHIVED,
  S.CONTRACT_SIGNED,
];

export class Application extends AggregateRoot<string> {
  private props: ApplicationProps;

  private constructor(id: string, props: ApplicationProps) {
    super(id);
    ApplicationId.create(id);

    if (!props.candidateId) {
      throw new Error('An application cannot exist without a candidate');
    }
    if (!props.jobId) {
      throw new Error('An application cannot exist without a job');
    }
    if (!props.companyId) {
      throw new Error('An application cannot exist without an owner company');
    }

    this.props = props;
  }

  get applicationId(): ApplicationId {
    return ApplicationId.create(this.id);
  }

  get candidateId(): string {
    return this.props.candidateId;
  }

  get jobId(): string {
    return this.props.jobId;
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get status(): ApplicationLifecycleStatus {
    return this.props.status;
  }

  get snapshot(): ApplicationSnapshot {
    return this.props.snapshot;
  }

  get channel(): ApplicationChannel {
    return this.props.channel;
  }

  get timeline(): Timeline {
    return this.props.timeline;
  }

  get intelligence(): ApplicationIntelligence | null {
    return this.props.intelligence;
  }

  get submittedAt(): Date | null {
    return this.props.submittedAt;
  }

  get lastActivityAt(): Date {
    return this.props.lastActivityAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isTerminal(): boolean {
    return TERMINAL_STATES.includes(this.props.status);
  }

  isActive(): boolean {
    return !this.isTerminal();
  }

  canTransitionTo(target: ApplicationLifecycleStatus): boolean {
    return CanTransitionSpecification.isSatisfiedBy(this.props.status, target);
  }

  /** Registers a brand-new Application in DRAFT and raises ApplicationCreated + ApplicationTransitioned. */
  static create(
    id: string,
    candidateId: string,
    jobId: string,
    companyId: string,
    snapshot: ApplicationSnapshot,
    channel: ApplicationChannel,
    actor: Actor,
    correlationId: CorrelationId,
  ): Application {
    const now = new Date();
    const application = new Application(id, {
      candidateId,
      jobId,
      companyId,
      status: S.DRAFT,
      snapshot,
      channel,
      timeline: Timeline.empty(),
      intelligence: null,
      submittedAt: null,
      lastActivityAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const entry = TimelineEntry.create(randomUUID(), {
      timestamp: now,
      actor,
      source: channel,
      reason: null,
      previousState: null,
      currentState: S.DRAFT,
      metadata: Metadata.empty(),
      correlationId,
      evidenceReference: null,
      confidence: null,
    });
    application.props.timeline = application.props.timeline.append(entry);

    application.addDomainEvent(new ApplicationCreated(id, correlationId.value, S.DRAFT, actor, snapshot, channel));
    application.addDomainEvent(new ApplicationTransitioned(id, correlationId.value, null, S.DRAFT, actor));
    return application;
  }

  /** Rehydrates an Application from persistence without re-raising domain events. */
  static reconstitute(id: string, props: ApplicationProps): Application {
    return new Application(id, props);
  }

  prepare(actor: Actor, correlationId: CorrelationId, reason?: TransitionReason): void {
    const target = S.PREPARED;
    this.guard(target, new ReadinessPolicy(), actor);
    const previous = this.applyTransition(target, actor, correlationId, reason ?? null, Metadata.empty(), null, null);
    this.raise(new ApplicationPrepared(this.id, correlationId.value, previous, target, actor), correlationId, previous, target, actor);
  }

  queue(actor: Actor, correlationId: CorrelationId, reason?: TransitionReason): void {
    const target = S.QUEUED;
    this.guard(target, new SchedulingPolicy(), actor);
    const previous = this.applyTransition(target, actor, correlationId, reason ?? null, Metadata.empty(), null, null);
    this.raise(new ApplicationQueued(this.id, correlationId.value, previous, target, actor), correlationId, previous, target, actor);
  }

  send(actor: Actor, correlationId: CorrelationId): void {
    const target = S.SENT;
    this.guard(target, new DispatchPolicy(), actor);
    const previous = this.applyTransition(target, actor, correlationId, null, Metadata.empty(), null, null);
    this.props.submittedAt = this.props.updatedAt;
    this.raise(
      new ApplicationSent(this.id, correlationId.value, previous, target, actor, this.props.submittedAt),
      correlationId,
      previous,
      target,
      actor,
    );
  }

  markDelivered(actor: Actor, correlationId: CorrelationId, evidence: EvidenceReference, confidence: ConfidenceScore): void {
    const target = S.DELIVERED;
    this.guard(target, new TrackingSignalPolicy(), actor);
    this.requireEvidence('markDelivered', evidence, confidence);
    const previous = this.applyTransition(target, actor, correlationId, null, Metadata.empty(), evidence, confidence);
    this.raise(
      new ApplicationDelivered(this.id, correlationId.value, previous, target, actor, evidence, confidence),
      correlationId,
      previous,
      target,
      actor,
    );
  }

  markOpened(actor: Actor, correlationId: CorrelationId, evidence: EvidenceReference, confidence: ConfidenceScore): void {
    const target = S.OPENED;
    this.guard(target, new TrackingSignalPolicy(), actor);
    this.requireEvidence('markOpened', evidence, confidence);
    const previous = this.applyTransition(target, actor, correlationId, null, Metadata.empty(), evidence, confidence);
    this.raise(
      new ApplicationOpened(this.id, correlationId.value, previous, target, actor, evidence, confidence),
      correlationId,
      previous,
      target,
      actor,
    );
  }

  markViewed(actor: Actor, correlationId: CorrelationId, evidence: EvidenceReference, confidence: ConfidenceScore): void {
    const target = S.VIEWED;
    this.guard(target, new TrackingSignalPolicy(), actor);
    this.requireEvidence('markViewed', evidence, confidence);
    const previous = this.applyTransition(target, actor, correlationId, null, Metadata.empty(), evidence, confidence);
    this.raise(
      new ApplicationViewed(this.id, correlationId.value, previous, target, actor, evidence, confidence),
      correlationId,
      previous,
      target,
      actor,
    );
  }

  recordCompanyReply(actor: Actor, correlationId: CorrelationId, reason?: TransitionReason): void {
    const target = S.COMPANY_REPLIED;
    this.guard(target, new ResponsePolicy(), actor);
    const previous = this.applyTransition(target, actor, correlationId, reason ?? null, Metadata.empty(), null, null);
    this.raise(new CompanyReplied(this.id, correlationId.value, previous, target, actor), correlationId, previous, target, actor);
  }

  scheduleInterview(actor: Actor, correlationId: CorrelationId, metadata: Metadata): void {
    const target = S.INTERVIEW_SCHEDULED;
    this.guard(target, new InterviewPolicy(), actor);
    const previous = this.applyTransition(target, actor, correlationId, null, metadata, null, null);
    this.raise(
      new InterviewScheduled(this.id, correlationId.value, previous, target, actor, metadata),
      correlationId,
      previous,
      target,
      actor,
    );
  }

  completeInterview(actor: Actor, correlationId: CorrelationId, metadata?: Metadata): void {
    const target = S.INTERVIEW_COMPLETED;
    this.guard(target, new InterviewPolicy(), actor);
    const resolvedMetadata = metadata ?? Metadata.empty();
    const previous = this.applyTransition(target, actor, correlationId, null, resolvedMetadata, null, null);
    this.raise(
      new InterviewCompleted(this.id, correlationId.value, previous, target, actor, resolvedMetadata),
      correlationId,
      previous,
      target,
      actor,
    );
  }

  /** Allowed from COMPANY_REPLIED (fast-track, e.g. Ausbildung/referral) or INTERVIEW_COMPLETED. */
  recordOffer(actor: Actor, correlationId: CorrelationId, metadata: Metadata): void {
    const target = S.OFFER_RECEIVED;
    this.guard(target, new OfferPolicy(), actor);
    const previous = this.applyTransition(target, actor, correlationId, null, metadata, null, null);
    this.raise(
      new OfferReceived(this.id, correlationId.value, previous, target, actor, metadata),
      correlationId,
      previous,
      target,
      actor,
    );
  }

  signContract(actor: Actor, correlationId: CorrelationId, metadata?: Metadata): void {
    const target = S.CONTRACT_SIGNED;
    this.guard(target, new ContractPolicy(), actor);
    const previous = this.applyTransition(target, actor, correlationId, null, metadata ?? Metadata.empty(), null, null);
    this.raise(new ContractSigned(this.id, correlationId.value, previous, target, actor), correlationId, previous, target, actor);
  }

  reject(actor: Actor, correlationId: CorrelationId, reason: TransitionReason): void {
    const target = S.REJECTED;
    this.guard(target, new RejectionPolicy(), actor);
    this.requireReason('reject', reason);
    const previous = this.applyTransition(target, actor, correlationId, reason, Metadata.empty(), null, null);
    this.raise(new ApplicationRejected(this.id, correlationId.value, previous, target, actor, reason), correlationId, previous, target, actor);
  }

  withdraw(actor: Actor, correlationId: CorrelationId, reason: TransitionReason): void {
    const target = S.WITHDRAWN;
    this.guard(target, new WithdrawalPolicy(), actor);
    this.requireReason('withdraw', reason);
    const previous = this.applyTransition(target, actor, correlationId, reason, Metadata.empty(), null, null);
    this.raise(new ApplicationWithdrawn(this.id, correlationId.value, previous, target, actor, reason), correlationId, previous, target, actor);
  }

  /** `companyOwnerId` (M31.1) — the real `Company.ownerId` for `this.props.companyId`, resolved
   * by the calling handler (a real repository lookup the domain layer itself cannot perform) and
   * passed in so `ArchivalPolicy` can authorize a Company actor without any I/O of its own. `null`
   * when the actor isn't a Company actor, or when the resolution genuinely found no such company —
   * either way `IsCompanyOwnerSpecification` treats `null` as "not the owner," never as "skip the
   * check." */
  archive(actor: Actor, correlationId: CorrelationId, companyOwnerId: string | null, reason?: TransitionReason): void {
    const target = S.ARCHIVED;
    this.guard(target, new ArchivalPolicy(), actor, { companyOwnerId, hasReason: Boolean(reason) });
    const previous = this.applyTransition(target, actor, correlationId, reason ?? null, Metadata.empty(), null, null);
    this.raise(
      new ApplicationArchived(this.id, correlationId.value, previous, target, actor, reason ?? null),
      correlationId,
      previous,
      target,
      actor,
    );
  }

  /**
   * The sole extension point through which a future Intelligence Engine attaches its
   * assessment. This domain never calls it and never computes the values it carries.
   */
  recordIntelligenceAssessment(assessment: ApplicationIntelligence, _actor: Actor): void {
    this.props.intelligence = assessment;
    this.props.updatedAt = new Date();
  }

  /** `companyOwnerId`/`hasReason` (M31.1) — only `ArchivalPolicy` currently reads either; every
   * other policy's own narrower `authorize()` signature ignores them, same as it already ignores
   * `currentState`/`targetState` where irrelevant. */
  private guard(
    target: ApplicationLifecycleStatus,
    policy: ApplicationPolicy,
    actor: Actor,
    extra: { companyOwnerId?: string | null; hasReason?: boolean } = {},
  ): void {
    if (!CanTransitionSpecification.isSatisfiedBy(this.props.status, target)) {
      throw new InvalidApplicationStatusTransitionException(this.props.status, target);
    }

    const decision = policy.authorize({
      actor,
      candidateId: this.props.candidateId,
      currentState: this.props.status,
      targetState: target,
      companyOwnerId: extra.companyOwnerId ?? null,
      hasReason: extra.hasReason ?? false,
    });
    if (!decision.allowed) {
      throw new UnauthorizedApplicationActionException(decision.explanation);
    }
  }

  private requireReason(action: string, reason: TransitionReason | undefined): asserts reason is TransitionReason {
    if (!reason) {
      throw new MissingTransitionReasonException(action);
    }
  }

  private requireEvidence(
    signal: string,
    evidence: EvidenceReference | undefined,
    confidence: ConfidenceScore | undefined,
  ): void {
    if (!evidence || !confidence) {
      throw new MissingTrackingEvidenceException(signal);
    }
  }

  private applyTransition(
    target: ApplicationLifecycleStatus,
    actor: Actor,
    correlationId: CorrelationId,
    reason: TransitionReason | null,
    metadata: Metadata,
    evidenceReference: EvidenceReference | null,
    confidence: ConfidenceScore | null,
  ): ApplicationLifecycleStatus {
    const previousState = this.props.status;
    this.props.status = target;
    this.touch();

    const entry = TimelineEntry.create(randomUUID(), {
      timestamp: this.props.updatedAt,
      actor,
      source: this.props.channel,
      reason,
      previousState,
      currentState: target,
      metadata,
      correlationId,
      evidenceReference,
      confidence,
    });
    this.props.timeline = this.props.timeline.append(entry);

    return previousState;
  }

  private raise(
    specificEvent: ApplicationLifecycleEvent,
    correlationId: CorrelationId,
    previous: ApplicationLifecycleStatus,
    current: ApplicationLifecycleStatus,
    actor: Actor,
  ): void {
    this.addDomainEvent(specificEvent);
    this.addDomainEvent(new ApplicationTransitioned(this.id, correlationId.value, previous, current, actor));
  }

  private touch(): void {
    const now = new Date();
    this.props.updatedAt = now;
    this.props.lastActivityAt = now;
  }
}
