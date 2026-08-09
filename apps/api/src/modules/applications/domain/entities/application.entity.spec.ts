import { ApplicationLifecycleStatus, TransitionReasonCode } from '@german-job-engine/shared-types';
import { Application } from './application.entity';
import { ApplicationSnapshot } from '../value-objects/application-snapshot.vo';
import { ApplicationChannel } from '../value-objects/application-channel.vo';
import { Actor } from '../value-objects/actor.vo';
import { CorrelationId } from '../value-objects/correlation-id.vo';
import { TransitionReason } from '../value-objects/transition-reason.vo';
import { EvidenceReference } from '../value-objects/evidence-reference.vo';
import { ConfidenceScore } from '../value-objects/confidence-score.vo';
import { Metadata } from '../value-objects/metadata.vo';
import { ApplicationIntelligence } from '../value-objects/application-intelligence.vo';
import { ApplicationCreated } from '../events/application-created.event';
import { ApplicationSent } from '../events/application-sent.event';
import { ApplicationTransitioned } from '../events/application-transitioned.event';
import { InvalidApplicationStatusTransitionException } from '../exceptions/invalid-application-status-transition.exception';
import { UnauthorizedApplicationActionException } from '../exceptions/unauthorized-application-action.exception';
import { MissingTransitionReasonException } from '../exceptions/missing-transition-reason.exception';
import { MissingTrackingEvidenceException } from '../exceptions/missing-tracking-evidence.exception';

const VALID_ID = '123e4567-e89b-12d3-a456-426614174000';
const CANDIDATE_ID = 'candidate-1';
const JOB_ID = 'job-1';
const COMPANY_ID = 'company-1';

function correlationId(): CorrelationId {
  return CorrelationId.create('corr-1');
}

function snapshot(): ApplicationSnapshot {
  return ApplicationSnapshot.create({ jobTitle: 'Backend Engineer', companyName: 'Acme GmbH', jobLocation: 'Berlin' });
}

function createApplication(): Application {
  return Application.create(
    VALID_ID,
    CANDIDATE_ID,
    JOB_ID,
    COMPANY_ID,
    snapshot(),
    ApplicationChannel.direct(),
    Actor.candidate(CANDIDATE_ID),
    correlationId(),
  );
}

function evidence(): EvidenceReference {
  return EvidenceReference.create({ type: 'email-webhook', externalId: 'evt-1' });
}

function confidence(): ConfidenceScore {
  return ConfidenceScore.create(0.9);
}

describe('Application', () => {
  it('starts DRAFT and raises ApplicationCreated + ApplicationTransitioned on creation', () => {
    const application = createApplication();

    expect(application.status).toBe(ApplicationLifecycleStatus.DRAFT);
    expect(application.candidateId).toBe(CANDIDATE_ID);
    expect(application.jobId).toBe(JOB_ID);
    expect(application.companyId).toBe(COMPANY_ID);
    expect(application.domainEvents).toHaveLength(2);
    expect(application.domainEvents[0]).toBeInstanceOf(ApplicationCreated);
    expect(application.domainEvents[1]).toBeInstanceOf(ApplicationTransitioned);
    expect(application.timeline.entries()).toHaveLength(1);
    expect(application.timeline.entries()[0].currentState).toBe(ApplicationLifecycleStatus.DRAFT);
    expect(application.timeline.entries()[0].previousState).toBeNull();
  });

  it('rejects creation without a candidate, job, or company', () => {
    expect(() =>
      Application.create(VALID_ID, '', JOB_ID, COMPANY_ID, snapshot(), ApplicationChannel.direct(), Actor.candidate('x'), correlationId()),
    ).toThrow(/cannot exist without a candidate/);
    expect(() =>
      Application.create(VALID_ID, CANDIDATE_ID, '', COMPANY_ID, snapshot(), ApplicationChannel.direct(), Actor.candidate('x'), correlationId()),
    ).toThrow(/cannot exist without a job/);
    expect(() =>
      Application.create(VALID_ID, CANDIDATE_ID, JOB_ID, '', snapshot(), ApplicationChannel.direct(), Actor.candidate('x'), correlationId()),
    ).toThrow(/cannot exist without an owner company/);
  });

  it('walks the full happy-path lifecycle to CONTRACT_SIGNED, appending one timeline entry per transition', () => {
    const application = createApplication();
    application.clearDomainEvents();

    application.prepare(Actor.candidate(CANDIDATE_ID), correlationId());
    expect(application.status).toBe(ApplicationLifecycleStatus.PREPARED);

    application.queue(Actor.candidate(CANDIDATE_ID), correlationId());
    expect(application.status).toBe(ApplicationLifecycleStatus.QUEUED);

    application.send(Actor.candidate(CANDIDATE_ID), correlationId());
    expect(application.status).toBe(ApplicationLifecycleStatus.SENT);
    expect(application.submittedAt).not.toBeNull();
    expect(application.domainEvents.some((e) => e instanceof ApplicationSent)).toBe(true);

    application.markDelivered(Actor.system('webhook'), correlationId(), evidence(), confidence());
    expect(application.status).toBe(ApplicationLifecycleStatus.DELIVERED);

    application.markOpened(Actor.system('webhook'), correlationId(), evidence(), confidence());
    expect(application.status).toBe(ApplicationLifecycleStatus.OPENED);

    application.markViewed(Actor.system('webhook'), correlationId(), evidence(), confidence());
    expect(application.status).toBe(ApplicationLifecycleStatus.VIEWED);

    application.recordCompanyReply(Actor.company('company-user-1'), correlationId());
    expect(application.status).toBe(ApplicationLifecycleStatus.COMPANY_REPLIED);

    application.scheduleInterview(Actor.company('company-user-1'), correlationId(), Metadata.create({ location: 'onsite' }));
    expect(application.status).toBe(ApplicationLifecycleStatus.INTERVIEW_SCHEDULED);

    application.completeInterview(Actor.company('company-user-1'), correlationId());
    expect(application.status).toBe(ApplicationLifecycleStatus.INTERVIEW_COMPLETED);

    application.recordOffer(Actor.company('company-user-1'), correlationId(), Metadata.create({ salary: 60000 }));
    expect(application.status).toBe(ApplicationLifecycleStatus.OFFER_RECEIVED);

    application.signContract(Actor.candidate(CANDIDATE_ID), correlationId());
    expect(application.status).toBe(ApplicationLifecycleStatus.CONTRACT_SIGNED);
    expect(application.isTerminal()).toBe(true);

    expect(application.timeline.entries()).toHaveLength(12);
  });

  it('allows OFFER_RECEIVED directly from COMPANY_REPLIED (fast-track)', () => {
    const application = createApplication();
    application.prepare(Actor.candidate(CANDIDATE_ID), correlationId());
    application.queue(Actor.candidate(CANDIDATE_ID), correlationId());
    application.send(Actor.candidate(CANDIDATE_ID), correlationId());
    application.recordCompanyReply(Actor.company('company-user-1'), correlationId());

    application.recordOffer(Actor.company('company-user-1'), correlationId(), Metadata.empty());

    expect(application.status).toBe(ApplicationLifecycleStatus.OFFER_RECEIVED);
  });

  describe('exit lanes', () => {
    it('rejects an active application with a mandatory reason', () => {
      const application = createApplication();
      application.prepare(Actor.candidate(CANDIDATE_ID), correlationId());
      application.queue(Actor.candidate(CANDIDATE_ID), correlationId());
      application.send(Actor.candidate(CANDIDATE_ID), correlationId());
      const reason = TransitionReason.create(TransitionReasonCode.QUALIFICATION_MISMATCH, 'Not enough experience');

      application.reject(Actor.company('company-user-1'), correlationId(), reason);

      expect(application.status).toBe(ApplicationLifecycleStatus.REJECTED);
      expect(application.isTerminal()).toBe(true);
    });

    it('withdraws only when the owning candidate is the actor', () => {
      const application = createApplication();
      const reason = TransitionReason.create(TransitionReasonCode.CANDIDATE_REQUEST);

      expect(() => application.withdraw(Actor.candidate('someone-else'), correlationId(), reason)).toThrow(
        UnauthorizedApplicationActionException,
      );

      application.withdraw(Actor.candidate(CANDIDATE_ID), correlationId(), reason);
      expect(application.status).toBe(ApplicationLifecycleStatus.WITHDRAWN);
    });

    it('archives from any non-terminal state and even from a terminal one', () => {
      const application = createApplication();
      const reason = TransitionReason.create(TransitionReasonCode.CANDIDATE_REQUEST);
      application.archive(Actor.admin('admin-1'), correlationId(), null, reason);
      expect(application.status).toBe(ApplicationLifecycleStatus.ARCHIVED);
    });
  });

  // M31.1 — real ownership enforcement for archive(), replacing the previously trivially-
  // permissive ArchivalPolicy. Domain-layer tests (the authoritative boundary); handler/command-
  // level tests (cross-user enumeration, invalid application, concurrency) live in
  // archive-application.handler.spec.ts.
  describe('archive() authorization', () => {
    it('allows the owning candidate to archive their own application', () => {
      const application = createApplication();
      application.archive(Actor.candidate(CANDIDATE_ID), correlationId(), null);
      expect(application.status).toBe(ApplicationLifecycleStatus.ARCHIVED);
    });

    it('denies a different candidate from archiving an application they do not own', () => {
      const application = createApplication();
      expect(() => application.archive(Actor.candidate('someone-else'), correlationId(), null)).toThrow(
        UnauthorizedApplicationActionException,
      );
      expect(application.status).toBe(ApplicationLifecycleStatus.DRAFT);
    });

    it('allows the owning company (the employer user id matching the resolved companyOwnerId) to archive', () => {
      const application = createApplication();
      application.archive(Actor.company('employer-user-1'), correlationId(), 'employer-user-1');
      expect(application.status).toBe(ApplicationLifecycleStatus.ARCHIVED);
    });

    it('denies a company actor whose user id does not match the resolved companyOwnerId', () => {
      const application = createApplication();
      expect(() =>
        application.archive(Actor.company('employer-user-1'), correlationId(), 'a-different-employer-user'),
      ).toThrow(UnauthorizedApplicationActionException);
      expect(application.status).toBe(ApplicationLifecycleStatus.DRAFT);
    });

    it('denies a company actor when companyOwnerId could not be resolved at all (null)', () => {
      const application = createApplication();
      expect(() => application.archive(Actor.company('employer-user-1'), correlationId(), null)).toThrow(
        UnauthorizedApplicationActionException,
      );
    });

    it('denies an admin archiving without a reason', () => {
      const application = createApplication();
      expect(() => application.archive(Actor.admin('admin-1'), correlationId(), null)).toThrow(
        UnauthorizedApplicationActionException,
      );
      expect(application.status).toBe(ApplicationLifecycleStatus.DRAFT);
    });

    it('allows an admin archiving with a reason, and records it on the raised event and timeline', () => {
      const application = createApplication();
      const reason = TransitionReason.create(TransitionReasonCode.CANDIDATE_REQUEST, 'cleanup');
      application.archive(Actor.admin('admin-1'), correlationId(), null, reason);

      expect(application.status).toBe(ApplicationLifecycleStatus.ARCHIVED);
      const archivedEvent = application.domainEvents.find((event) => event.constructor.name === 'ApplicationArchived');
      expect(archivedEvent).toBeDefined();
      expect((archivedEvent as unknown as { reason: TransitionReason | null }).reason).toBe(reason);
      const lastEntry = application.timeline.entries()[application.timeline.entries().length - 1];
      expect(lastEntry.reason).toBe(reason);
      expect(lastEntry.actor.role).toBe('ADMIN');
    });

    it('allows a system actor to archive without a reason', () => {
      const application = createApplication();
      application.archive(Actor.system('retention-job'), correlationId(), null);
      expect(application.status).toBe(ApplicationLifecycleStatus.ARCHIVED);
    });

    it('cannot be bypassed by a direct call that skips the handler-level pre-check — the domain itself is the authority', () => {
      // No handler, no assertCanAccessApplication — calling the aggregate method directly, the
      // way a future caller or a bypassed command bus might, still enforces ownership.
      const application = createApplication();
      expect(() => application.archive(Actor.candidate('an-unrelated-candidate'), correlationId(), null)).toThrow(
        UnauthorizedApplicationActionException,
      );
    });
  });

  describe('guardrails', () => {
    it('refuses a transition that is not reachable from the current state', () => {
      const application = createApplication();

      expect(() => application.send(Actor.candidate(CANDIDATE_ID), correlationId())).toThrow(
        InvalidApplicationStatusTransitionException,
      );
    });

    it('refuses reject without a reason', () => {
      const application = createApplication();
      application.prepare(Actor.candidate(CANDIDATE_ID), correlationId());
      application.queue(Actor.candidate(CANDIDATE_ID), correlationId());
      application.send(Actor.candidate(CANDIDATE_ID), correlationId());

      expect(() =>
        application.reject(Actor.company('company-user-1'), correlationId(), undefined as unknown as TransitionReason),
      ).toThrow(MissingTransitionReasonException);
    });

    it('refuses markDelivered without evidence', () => {
      const application = createApplication();
      application.prepare(Actor.candidate(CANDIDATE_ID), correlationId());
      application.queue(Actor.candidate(CANDIDATE_ID), correlationId());
      application.send(Actor.candidate(CANDIDATE_ID), correlationId());

      expect(() =>
        application.markDelivered(
          Actor.system('webhook'),
          correlationId(),
          undefined as unknown as EvidenceReference,
          undefined as unknown as ConfidenceScore,
        ),
      ).toThrow(MissingTrackingEvidenceException);
    });

    it('refuses markDelivered from a non-system actor (TrackingSignalPolicy)', () => {
      const application = createApplication();
      application.prepare(Actor.candidate(CANDIDATE_ID), correlationId());
      application.queue(Actor.candidate(CANDIDATE_ID), correlationId());
      application.send(Actor.candidate(CANDIDATE_ID), correlationId());

      expect(() =>
        application.markDelivered(Actor.candidate(CANDIDATE_ID), correlationId(), evidence(), confidence()),
      ).toThrow(UnauthorizedApplicationActionException);
    });

    it('refuses recordOffer from a non-company actor (OfferPolicy)', () => {
      const application = createApplication();
      application.prepare(Actor.candidate(CANDIDATE_ID), correlationId());
      application.queue(Actor.candidate(CANDIDATE_ID), correlationId());
      application.send(Actor.candidate(CANDIDATE_ID), correlationId());
      application.recordCompanyReply(Actor.company('company-user-1'), correlationId());

      expect(() =>
        application.recordOffer(Actor.candidate(CANDIDATE_ID), correlationId(), Metadata.empty()),
      ).toThrow(UnauthorizedApplicationActionException);
    });
  });

  it('attaches an intelligence assessment without raising a domain event or timeline entry', () => {
    const application = createApplication();
    application.clearDomainEvents();
    const timelineLengthBefore = application.timeline.entries().length;

    application.recordIntelligenceAssessment(
      ApplicationIntelligence.create({ computedBy: 'test-engine' }),
      Actor.automation('test-engine'),
    );

    expect(application.intelligence?.computedBy).toBe('test-engine');
    expect(application.domainEvents).toHaveLength(0);
    expect(application.timeline.entries()).toHaveLength(timelineLengthBefore);
  });

  it('does not raise domain events when reconstituted from persistence', () => {
    const application = Application.reconstitute(VALID_ID, {
      candidateId: CANDIDATE_ID,
      jobId: JOB_ID,
      companyId: COMPANY_ID,
      status: ApplicationLifecycleStatus.DRAFT,
      snapshot: snapshot(),
      channel: ApplicationChannel.direct(),
      timeline: createApplication().timeline,
      intelligence: null,
      submittedAt: null,
      lastActivityAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(application.domainEvents).toHaveLength(0);
  });
});
