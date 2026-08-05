import { DeliverabilityService } from './deliverability.service';
import { EmailQueueRepository } from '../../domain/ports/email-queue.repository';
import { EmailSuppressionRepository, EmailSuppressionEntryRecord } from '../../domain/ports/email-suppression.repository';
import { EmailTrackingService } from './email-tracking.service';
import { ExecutionClock } from '../../../execution/domain/ports/execution-clock.port';
import { EmailMessageRecord } from '../../domain/models/email-message';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';

const NOW = new Date('2026-08-01T12:00:00.000Z');

function message(overrides: Partial<EmailMessageRecord> = {}): EmailMessageRecord {
  return {
    id: 'msg-1',
    idempotencyKey: 'idem-1',
    priority: 'NORMAL',
    status: 'SENT',
    senderName: 'German Job Engine',
    senderEmail: 'noreply@example.com',
    recipientEmail: 'recruiter@example.de',
    subject: 'Application',
    plainTextBody: 'Hello',
    htmlBody: null,
    attachmentsMeta: [],
    attachmentRefs: [],
    senderIdentityId: null,
    providerId: 'resend',
    providerMessageId: 'pm-1',
    attempts: 1,
    maxAttempts: 5,
    nextAttemptAt: null,
    lastFailureReason: null,
    correlationId: null,
    traceId: null,
    campaignId: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function harness() {
  const suppression: jest.Mocked<EmailSuppressionRepository> = {
    isSuppressed: jest.fn(),
    suppress: jest.fn(),
    remove: jest.fn(),
    list: jest.fn(),
    count: jest.fn(),
  };
  const queue: jest.Mocked<EmailQueueRepository> = {
    enqueue: jest.fn(),
    findByIdempotencyKey: jest.fn(),
    findById: jest.fn(),
    findByProviderMessageId: jest.fn(),
    claimBatch: jest.fn(),
    markSent: jest.fn(),
    markDeferredForRetry: jest.fn(),
    markDeadLetter: jest.fn(),
    markSuppressed: jest.fn(),
    applyProviderStatus: jest.fn(),
    listByStatus: jest.fn(),
    countByStatus: jest.fn(),
  };
  const clock: ExecutionClock = { now: () => NOW };
  const tracking = { track: jest.fn().mockResolvedValue(undefined), history: jest.fn() } as unknown as jest.Mocked<EmailTrackingService>;
  const count = jest.fn();
  const prisma = { emailMessage: { count } } as unknown as PrismaService;

  const service = new DeliverabilityService(suppression, queue, clock, tracking, prisma);
  return { service, suppression, queue, tracking, count };
}

describe('DeliverabilityService', () => {
  it('delegates isSuppressed to the suppression repository', async () => {
    const { service, suppression } = harness();
    suppression.isSuppressed.mockResolvedValue(true);
    await expect(service.isSuppressed('a@b.de')).resolves.toBe(true);
    expect(suppression.isSuppressed).toHaveBeenCalledWith('a@b.de');
  });

  it('handleHardBounce marks the message BOUNCED and suppresses the address', async () => {
    const { service, queue, suppression, tracking } = harness();
    const msg = message();

    await service.handleHardBounce(msg, 'resend', 'mailbox does not exist');

    expect(queue.applyProviderStatus).toHaveBeenCalledWith(msg.id, 'BOUNCED', NOW);
    expect(suppression.suppress).toHaveBeenCalledWith(msg.recipientEmail, 'HARD_BOUNCE', 'resend', 'mailbox does not exist', NOW);
    expect(tracking.track).toHaveBeenCalledWith(msg.id, 'BOUNCED_HARD', expect.anything());
  });

  it('handleSoftBounce marks the message DEFERRED and does NOT suppress the address', async () => {
    const { service, queue, suppression } = harness();
    const msg = message();

    await service.handleSoftBounce(msg, 'resend', 'mailbox full');

    expect(queue.applyProviderStatus).toHaveBeenCalledWith(msg.id, 'DEFERRED', NOW);
    expect(suppression.suppress).not.toHaveBeenCalled();
  });

  it('handleComplaint marks the message COMPLAINED and suppresses the address', async () => {
    const { service, queue, suppression } = harness();
    const msg = message();

    await service.handleComplaint(msg, 'sendgrid', 'abuse report');

    expect(queue.applyProviderStatus).toHaveBeenCalledWith(msg.id, 'COMPLAINED', NOW);
    expect(suppression.suppress).toHaveBeenCalledWith(msg.recipientEmail, 'COMPLAINT', 'sendgrid', 'abuse report', NOW);
  });

  it('handleDelivered marks the message DELIVERED', async () => {
    const { service, queue } = harness();
    const msg = message();
    await service.handleDelivered(msg, 'ses');
    expect(queue.applyProviderStatus).toHaveBeenCalledWith(msg.id, 'DELIVERED', NOW);
  });

  it('handleOpened only records an event — it never touches the message status', async () => {
    const { service, queue, tracking } = harness();
    const msg = message();
    await service.handleOpened(msg, 'resend');
    expect(tracking.track).toHaveBeenCalledWith(msg.id, 'OPENED', expect.anything());
    expect(queue.applyProviderStatus).not.toHaveBeenCalled();
  });

  it('handleClicked only records an event with the clicked URL', async () => {
    const { service, tracking } = harness();
    const msg = message();
    await service.handleClicked(msg, 'sendgrid', 'https://example.com/apply');
    expect(tracking.track).toHaveBeenCalledWith(msg.id, 'CLICKED', { providerId: 'sendgrid', detail: 'https://example.com/apply' });
  });

  it('suppressManually records the admin as the source', async () => {
    const { service, suppression } = harness();
    suppression.suppress.mockResolvedValue({} as EmailSuppressionEntryRecord);
    await service.suppressManually('a@b.de', 'requested removal', 'admin-42');
    expect(suppression.suppress).toHaveBeenCalledWith('a@b.de', 'MANUAL', 'ADMIN:admin-42', 'requested removal', NOW);
  });

  describe('getReputationSnapshot', () => {
    it('classifies HEALTHY when bounce and complaint rates are both low', async () => {
      const { service, count } = harness();
      count.mockResolvedValueOnce(1000).mockResolvedValueOnce(950).mockResolvedValueOnce(10).mockResolvedValueOnce(0);

      const snapshot = await service.getReputationSnapshot(30);

      expect(snapshot).toMatchObject({ sent: 1000, bounced: 10, complained: 0, healthLabel: 'HEALTHY' });
    });

    it('classifies AT_RISK when the bounce rate crosses 5%', async () => {
      const { service, count } = harness();
      count.mockResolvedValueOnce(1000).mockResolvedValueOnce(900).mockResolvedValueOnce(60).mockResolvedValueOnce(0);

      const snapshot = await service.getReputationSnapshot(30);

      expect(snapshot.healthLabel).toBe('AT_RISK');
    });

    it('classifies CRITICAL when the bounce rate crosses 10%', async () => {
      const { service, count } = harness();
      count.mockResolvedValueOnce(1000).mockResolvedValueOnce(850).mockResolvedValueOnce(110).mockResolvedValueOnce(0);

      const snapshot = await service.getReputationSnapshot(30);

      expect(snapshot.healthLabel).toBe('CRITICAL');
    });

    it('classifies CRITICAL when the complaint rate crosses 0.1%, even with a healthy bounce rate', async () => {
      const { service, count } = harness();
      count.mockResolvedValueOnce(1000).mockResolvedValueOnce(990).mockResolvedValueOnce(2).mockResolvedValueOnce(2);

      const snapshot = await service.getReputationSnapshot(30);

      expect(snapshot.healthLabel).toBe('CRITICAL');
    });

    it('treats a zero-volume window as HEALTHY rather than dividing by zero', async () => {
      const { service, count } = harness();
      count.mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(0);

      const snapshot = await service.getReputationSnapshot(30);

      expect(snapshot).toMatchObject({ sent: 0, bounceRate: 0, complaintRate: 0, healthLabel: 'HEALTHY' });
    });
  });
});
