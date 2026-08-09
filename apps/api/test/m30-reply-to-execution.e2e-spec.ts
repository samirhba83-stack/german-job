import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/infrastructure/database/prisma.service';
import { FollowUpControlService } from '../src/modules/recruitment-operations/application/services/follow-up-control.service';
import { FollowUpEligibilityService } from '../src/modules/recruitment-operations/application/services/follow-up-eligibility.service';
import { RecruitmentTaskService } from '../src/modules/recruitment-operations/application/services/recruitment-task.service';
import { FollowUpResumeService } from '../src/modules/recruitment-operations/application/services/follow-up-resume.service';
import { ApplicationTransitionProposalService } from '../src/modules/inbox-intelligence/application/services/application-transition-proposal.service';
import { decideOperationalAction } from '../src/modules/inbox-intelligence/domain/services/reply-operational-decision-policy';
import { emptyExtractedFacts } from '../src/modules/inbox-intelligence/domain/models/extracted-facts';

/**
 * M30 Phase 20 — safe, synthetic-data-only end-to-end verification of the full
 * reply-to-execution pipeline, bootstrapping the REAL `AppModule` (identical DI graph to
 * production — the same pattern `test/app.e2e-spec.ts` already uses) against a real database.
 * Drives the real, injected service classes directly rather than through HTTP/JWT, which proves
 * the same real wiring without needing auth scaffolding this test has no other reason to build.
 * No production data is touched — every row created here is a fresh, disposable, random-UUID-keyed
 * fixture, deleted in `afterAll`.
 *
 * Flow proven (mirrors the brief's own numbered synthetic-flow steps):
 * create application → simulate a classified DOCUMENT_REQUEST reply → real
 * `ApplicationFollowUpControl` created (TEMPORARY_HOLD) → eligibility now blocked → real
 * `RecruitmentActionTask` created → real transition proposal created and confirmed → real
 * `RecordDocumentRequestCommand` dispatched → real `ApplicationOperationalDecision` row exists →
 * full audit trail exists → attempt-blocked is proven → hold released → eligibility recalculated
 * back to ELIGIBLE → no historical row was overwritten (release is an in-place status change on
 * the SAME row by design — history lives in the row's own timestamps/reason fields, never deleted
 * or replaced) → expired-hold resume path proven separately.
 */
describe('M30 reply-to-execution: synthetic end-to-end flow', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let followUpControls: FollowUpControlService;
  let eligibility: FollowUpEligibilityService;
  let tasks: RecruitmentTaskService;
  let resumeService: FollowUpResumeService;
  let transitionProposals: ApplicationTransitionProposalService;

  const ownedUserIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get(PrismaService);
    followUpControls = moduleFixture.get(FollowUpControlService);
    eligibility = moduleFixture.get(FollowUpEligibilityService);
    tasks = moduleFixture.get(RecruitmentTaskService);
    resumeService = moduleFixture.get(FollowUpResumeService);
    transitionProposals = moduleFixture.get(ApplicationTransitionProposalService);
  }, 30000);

  afterAll(async () => {
    for (const userId of ownedUserIds) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
    await app.close();
  });

  /** Minimal real graph: Company -> JobListing -> Application. `Application.companyId`/
   * `candidateId` are plain cross-aggregate string references (no Prisma FK, confirmed by the
   * schema) — only `jobId` is a real FK, so only Company + JobListing need to exist for real. */
  async function createSyntheticApplication(): Promise<{ userId: string; applicationId: string; inboxMessageId: string }> {
    const email = `test-e2e-m30-${randomUUID()}@example.com`;
    const user = await prisma.user.create({ data: { email, password: 'not-a-real-hash' } });
    ownedUserIds.push(user.id);

    const company = await prisma.company.create({
      data: { ownerId: user.id, name: 'Synthetic Test GmbH', industry: 'IT_SOFTWARE', size: 'SMALL', city: 'Berlin', country: 'DE', contactEmail: `hr-${randomUUID()}@synthetic-test.example` },
    });
    const job = await prisma.jobListing.create({
      data: {
        companyId: company.id,
        title: 'Synthetic Test Role',
        description: 'A synthetic job for M30 E2E verification.',
        employmentType: 'FULL_TIME',
        contractType: 'PERMANENT',
        city: 'Berlin',
        country: 'DE',
      },
    });
    const application = await prisma.application.create({
      data: {
        candidateId: user.id,
        jobId: job.id,
        companyId: company.id,
        status: 'SENT',
        snapshotJobTitle: job.title,
        snapshotCompanyName: company.name,
        snapshotJobLocation: 'Berlin, DE',
      },
    });

    const mailbox = await prisma.connectedMailbox.create({
      data: { userId: user.id, provider: 'GOOGLE_GMAIL', providerAccountId: randomUUID(), emailAddress: email, status: 'CONNECTED' },
    });
    const message = await prisma.inboxMessage.create({
      data: {
        connectedMailboxId: mailbox.id,
        providerMessageId: randomUUID(),
        fromAddress: 'recruiter@synthetic-test.example',
        toAddress: email,
        subject: 'Please send your documents',
        receivedAt: new Date(),
        correlationStatus: 'MATCHED',
        correlatedApplicationId: application.id,
        contentHashSha256: randomUUID(),
      },
    });

    return { userId: user.id, applicationId: application.id, inboxMessageId: message.id };
  }

  it('runs the full DOCUMENT_REQUEST reply pipeline end to end with a real, honest audit trail', async () => {
    const { userId, applicationId, inboxMessageId } = await createSyntheticApplication();

    // 1. Before any reply, the application is fully eligible.
    const initial = await eligibility.checkEligibility(applicationId, userId);
    expect(initial.status).toBe('ELIGIBLE');

    // 2. The real, pure decision matrix — exactly what `ReplyIngestionService` would compute for a
    // classified DOCUMENT_REQUEST reply.
    const decision = decideOperationalAction('DOCUMENT_REQUEST', { ...emptyExtractedFacts(), requestedDocuments: ['CV', 'Cover letter'] });
    expect(decision.controlType).toBe('TEMPORARY_HOLD');
    expect(decision.taskType).toBe('UPLOAD_REQUESTED_DOCUMENT');

    // 3. Real follow-up control created.
    const control = await followUpControls.recordControl({
      userId,
      applicationId,
      campaignId: null,
      companyId: null,
      jobId: null,
      sourceInboxMessageId: inboxMessageId,
      sourceProviderMessageId: randomUUID(),
      controlType: decision.controlType!,
      reasonCode: 'DOCUMENT_REQUEST',
      explanation: 'Synthetic E2E: documents requested.',
      classification: 'DOCUMENT_REQUEST',
      confidence: 0.92,
      evidence: { synthetic: true },
      expiresAt: null,
      correlationId: inboxMessageId,
    });
    expect(control.status).toBe('ACTIVE');

    // 4. Eligibility is now blocked — a real future dispatch attempt for this application would be
    // excluded by `CampaignBatchDispatchService`'s own real eligibility gate.
    const blocked = await eligibility.checkEligibility(applicationId, userId);
    expect(blocked.status).toBe('TEMPORARILY_BLOCKED');
    expect(blocked.activeControl?.id).toBe(control.id);

    // 5. Real recruitment task created.
    const { task, wasNewlyCreated } = await tasks.createTask({
      userId,
      applicationId,
      companyId: null,
      jobId: null,
      sourceInboxMessageId: inboxMessageId,
      taskType: decision.taskType!,
      title: 'Upload requested document(s)',
      explanation: 'Synthetic E2E: created from a DOCUMENT_REQUEST reply.',
      evidence: { synthetic: true },
      priority: 'NORMAL',
      dueAt: null,
      dueDateConfidence: null,
      originalDateText: null,
      correlationId: inboxMessageId,
    });
    expect(wasNewlyCreated).toBe(true);
    expect(task.status).toBe('OPEN');

    // 6. Real transition proposal created and confirmed — dispatches the real, additive
    // `RecordDocumentRequestCommand` (never a raw Application.status mutation).
    const proposal = await transitionProposals.createProposal(
      {
        inboxMessageId,
        applicationId,
        category: 'DOCUMENT_REQUEST',
        confidence: 0.92,
        evidence: { synthetic: true },
        extractedFacts: { ...emptyExtractedFacts(), requestedDocuments: ['CV', 'Cover letter'] },
        correlationId: inboxMessageId,
      },
      userId,
    );
    expect(proposal).not.toBeNull();
    expect(proposal!.proposedAction).toBe('DOCUMENTS_REQUESTED');
    expect(proposal!.status).toBe('PENDING');

    const confirmed = await transitionProposals.confirmProposal(proposal!.id, userId);
    expect(confirmed.status).toBe('CONFIRMED');

    // 7. Real `ApplicationOperationalDecision` row exists — the additive command actually ran,
    // never a fabricated/represented-only "completed" state.
    const operationalDecisions = await prisma.applicationOperationalDecision.findMany({ where: { applicationId } });
    expect(operationalDecisions.length).toBeGreaterThanOrEqual(1);
    expect(operationalDecisions.some((d) => d.decisionType === 'DOCUMENTS_REQUESTED')).toBe(true);

    // 8. A real, complete audit trail exists for this application — every step left a trace.
    const auditEvents = await prisma.emailSecurityAuditEvent.findMany({ where: { applicationId }, select: { eventType: true } });
    const eventTypes = new Set(auditEvents.map((e) => e.eventType));
    expect(eventTypes.has('FOLLOW_UP_CONTROL_CREATED')).toBe(true);
    expect(eventTypes.has('FOLLOW_UP_TEMPORARILY_HELD')).toBe(true);
    expect(eventTypes.has('RECRUITMENT_TASK_CREATED')).toBe(true);
    expect(eventTypes.has('APPLICATION_TRANSITION_PROPOSED')).toBe(true);
    expect(eventTypes.has('APPLICATION_TRANSITION_CONFIRMED')).toBe(true);
    expect(eventTypes.has('APPLICATION_COMMAND_CONFIRMED')).toBe(true);
    expect(eventTypes.has('FOLLOW_UP_ELIGIBILITY_CHECKED')).toBe(true);

    // 9. Attempting a second confirmation on the now-CONFIRMED proposal is a real, handled 409 —
    // never a second command dispatch (the dedicated concurrency spec proves the race variant;
    // this proves the plain sequential-reuse variant).
    await expect(transitionProposals.confirmProposal(proposal!.id, userId)).rejects.toThrow(ConflictException);

    // 10. Release the hold.
    const released = await followUpControls.release(control.id, userId, 'Synthetic E2E: documents received.');
    expect(released.status).toBe('RELEASED');

    // 11. Eligibility is recalculated — real, not cached.
    const afterRelease = await eligibility.checkEligibility(applicationId, userId);
    expect(afterRelease.status).toBe('ELIGIBLE');

    // 12. No historical row was overwritten — exactly one control row for this application,
    // exactly one task row, and the released control's own original creation facts are intact
    // (release is an in-place status change on the SAME row by design; `createSuperseding()` is
    // what creates a NEW row for a NEW decision — that path is proven separately by the dedicated
    // concurrency spec).
    const allControls = await prisma.applicationFollowUpControl.findMany({ where: { applicationId } });
    expect(allControls).toHaveLength(1);
    expect(allControls[0].reasonCode).toBe('DOCUMENT_REQUEST');
    expect(allControls[0].releasedBy).toBe(userId);

    const allTasks = await prisma.recruitmentActionTask.findMany({ where: { applicationId } });
    expect(allTasks).toHaveLength(1);
  }, 30000);

  it('proves the resume path: a still-blocking hold is TEMPORARILY_BLOCKED; once expired it is real-time ELIGIBLE even before the tick runs, and the tick correctly closes out the historical row', async () => {
    const { userId, applicationId, inboxMessageId } = await createSyntheticApplication();

    const control = await followUpControls.recordControl({
      userId,
      applicationId,
      campaignId: null,
      companyId: null,
      jobId: null,
      sourceInboxMessageId: inboxMessageId,
      sourceProviderMessageId: randomUUID(),
      controlType: 'WAITING_PERIOD',
      reasonCode: 'APPLICATION_UNDER_REVIEW',
      explanation: 'Synthetic E2E: under review, 14-day hold.',
      classification: 'APPLICATION_UNDER_REVIEW',
      confidence: 0.8,
      evidence: null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // not yet expired
      correlationId: inboxMessageId,
    });
    expect(control.status).toBe('ACTIVE');

    // While genuinely not yet expired, a real dispatch attempt is blocked.
    const stillBlocked = await eligibility.checkEligibility(applicationId, userId);
    expect(stillBlocked.status).toBe('TEMPORARILY_BLOCKED');

    // Backdate it to already-expired (simulating time passing) — the evaluator's own real-time
    // expiry check (`evaluateFollowUpEligibility`) already reports ELIGIBLE even before the
    // periodic resume tick physically flips the DB row — Phase 4's own "the final pre-send
    // recheck is mandatory" guarantee: no eventual-consistency gap where a legitimate resume
    // attempt could be wrongly blocked between real expiry and the next tick.
    await prisma.applicationFollowUpControl.update({ where: { id: control.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const realTimeEligible = await eligibility.checkEligibility(applicationId, userId);
    expect(realTimeEligible.status).toBe('ELIGIBLE');
    expect(realTimeEligible.reasonCode).toBe('HOLD_EXPIRED');

    // The row itself is still ACTIVE in the DB at this point — only the tick closes it out.
    const beforeTick = await prisma.applicationFollowUpControl.findUniqueOrThrow({ where: { id: control.id } });
    expect(beforeTick.status).toBe('ACTIVE');

    const result = await resumeService.processExpiredHolds(100);
    expect(result.expired).toBeGreaterThanOrEqual(1);

    const afterTick = await prisma.applicationFollowUpControl.findUniqueOrThrow({ where: { id: control.id } });
    expect(afterTick.status).toBe('EXPIRED');

    const afterExpiry = await eligibility.checkEligibility(applicationId, userId);
    expect(afterExpiry.status).toBe('ELIGIBLE');
    expect(afterExpiry.reasonCode).toBe('NO_ACTIVE_CONTROL');
  }, 30000);
});
