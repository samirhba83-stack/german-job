import { ConfigService } from '@nestjs/config';
import { EmailQueueService } from './email-queue.service';
import { EmailQueueRepository } from '../../domain/ports/email-queue.repository';
import { EmailProviderManagerPort, EmailProviderManagerResult } from '../../domain/ports/email-provider-manager.port';
import { EmailMessageRecord, EnqueueEmailInput } from '../../domain/models/email-message';
import { EmailTrackingService } from './email-tracking.service';
import { DeliverabilityService } from './deliverability.service';
import { ExecutionClock } from '../../../execution/domain/ports/execution-clock.port';
import { EmailDeliveryResponse } from '../../../email-provider/domain/models/email-delivery-response';

const NOW = new Date('2026-08-01T12:00:00.000Z');

function baseRecord(overrides: Partial<EmailMessageRecord> = {}): EmailMessageRecord {
  return {
    id: 'msg-1',
    idempotencyKey: 'idem-1',
    priority: 'NORMAL',
    status: 'QUEUED',
    senderName: 'German Job Engine',
    senderEmail: 'noreply@example.com',
    recipientEmail: 'recruiter@example.de',
    subject: 'Application',
    plainTextBody: 'Hello',
    htmlBody: null,
    attachmentsMeta: [],
    attachmentRefs: [],
    senderIdentityId: null,
    providerId: null,
    providerMessageId: null,
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

function enqueueInput(overrides: Partial<EnqueueEmailInput> = {}): EnqueueEmailInput {
  return {
    idempotencyKey: 'idem-1',
    priority: 'NORMAL',
    sender: { displayName: 'German Job Engine', emailAddress: 'noreply@example.com' },
    recipientEmail: 'recruiter@example.de',
    subject: 'Application',
    plainTextBody: 'Hello',
    htmlBody: null,
    attachments: [],
    maxAttempts: 5,
    correlationId: null,
    traceId: null,
    campaignId: null,
    ...overrides,
  };
}

function harness() {
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
  const providerManager: jest.Mocked<EmailProviderManagerPort> = {
    sendWithFailover: jest.fn(),
  };
  const deliverability = { isSuppressed: jest.fn().mockResolvedValue(false) } as unknown as jest.Mocked<DeliverabilityService>;
  const tracking = { track: jest.fn().mockResolvedValue(undefined), history: jest.fn() } as unknown as jest.Mocked<EmailTrackingService>;
  const clock: ExecutionClock = { now: () => NOW };
  const config = {
    get: (key: string, defaultValue?: unknown) => {
      const values: Record<string, unknown> = {
        'emailInfrastructure.queue.baseBackoffMs': 30_000,
        'emailInfrastructure.queue.maxBackoffMs': 1_800_000,
      };
      return values[key] ?? defaultValue;
    },
  } as unknown as ConfigService;

  const service = new EmailQueueService(queue, providerManager, deliverability, tracking, clock, config);
  return { service, queue, providerManager, deliverability, tracking };
}

function acceptedResult(providerId = 'resend'): EmailProviderManagerResult {
  const response: EmailDeliveryResponse = {
    providerId,
    status: 'ACCEPTED',
    accepted: true,
    executedAt: NOW,
    providerMessage: 'ok',
    providerMetadata: { providerMessageId: 'pm-1' },
    failure: null,
  };
  return { response, attempts: [{ providerId, response, skippedCircuitOpen: false }] };
}

function failedResult(retryable: boolean, providerId = 'resend'): EmailProviderManagerResult {
  const response: EmailDeliveryResponse = {
    providerId,
    status: 'FAILED',
    accepted: false,
    executedAt: NOW,
    providerMessage: 'boom',
    providerMetadata: {},
    failure: { category: 'PROVIDER_UNAVAILABLE', message: 'boom', retryable },
  };
  return { response, attempts: [{ providerId, response, skippedCircuitOpen: false }] };
}

describe('EmailQueueService', () => {
  describe('enqueue', () => {
    it('is idempotent — a repeat call with the same idempotencyKey returns the existing row without re-enqueueing', async () => {
      const { service, queue } = harness();
      const existing = baseRecord();
      queue.findByIdempotencyKey.mockResolvedValue(existing);

      const result = await service.enqueue(enqueueInput());

      expect(result).toBe(existing);
      expect(queue.enqueue).not.toHaveBeenCalled();
    });

    it('checks suppression before letting a new message stay queued, and marks it SUPPRESSED', async () => {
      const { service, queue, deliverability, tracking } = harness();
      queue.findByIdempotencyKey.mockResolvedValue(null);
      const created = baseRecord({ status: 'QUEUED' });
      queue.enqueue.mockResolvedValue(created);
      deliverability.isSuppressed.mockResolvedValue(true);

      const result = await service.enqueue(enqueueInput());

      expect(result.status).toBe('SUPPRESSED');
      expect(queue.markSuppressed).toHaveBeenCalledWith(created.id, NOW);
      expect(tracking.track).toHaveBeenCalledWith(created.id, 'SUPPRESSED_SKIP', expect.anything());
    });

    it('enqueues normally when the recipient is not suppressed', async () => {
      const { service, queue, deliverability } = harness();
      queue.findByIdempotencyKey.mockResolvedValue(null);
      const created = baseRecord({ status: 'QUEUED' });
      queue.enqueue.mockResolvedValue(created);
      deliverability.isSuppressed.mockResolvedValue(false);

      const result = await service.enqueue(enqueueInput());

      expect(result).toBe(created);
      expect(queue.markSuppressed).not.toHaveBeenCalled();
    });
  });

  describe('processClaimed', () => {
    it('marks the message SENT on acceptance and records the provider message id', async () => {
      const { service, queue, providerManager, tracking } = harness();
      const message = baseRecord();
      providerManager.sendWithFailover.mockResolvedValue(acceptedResult('resend'));

      await service.processClaimed(message);

      expect(queue.markSent).toHaveBeenCalledWith(message.id, 'resend', 'pm-1', NOW);
      expect(tracking.track).toHaveBeenCalledWith(message.id, 'SENT', expect.anything());
    });

    it('schedules a retry with exponential backoff on a retryable failure under maxAttempts', async () => {
      const { service, queue, providerManager } = harness();
      const message = baseRecord({ attempts: 2, maxAttempts: 5 });
      providerManager.sendWithFailover.mockResolvedValue(failedResult(true));

      await service.processClaimed(message);

      expect(queue.markDeadLetter).not.toHaveBeenCalled();
      expect(queue.markDeferredForRetry).toHaveBeenCalledTimes(1);
      const [, , nextAttemptAt] = queue.markDeferredForRetry.mock.calls[0];
      // attempts=2 -> exponential = 30_000 * 2^(2-1) = 60_000ms
      expect(nextAttemptAt.getTime() - NOW.getTime()).toBe(60_000);
    });

    it('caps backoff at maxBackoffMs for a high attempt count', async () => {
      const { service, queue, providerManager } = harness();
      const message = baseRecord({ attempts: 20, maxAttempts: 25 });
      providerManager.sendWithFailover.mockResolvedValue(failedResult(true));

      await service.processClaimed(message);

      const [, , nextAttemptAt] = queue.markDeferredForRetry.mock.calls[0];
      expect(nextAttemptAt.getTime() - NOW.getTime()).toBe(1_800_000);
    });

    it('dead-letters immediately on a non-retryable failure, regardless of attempts remaining', async () => {
      const { service, queue, providerManager } = harness();
      const message = baseRecord({ attempts: 1, maxAttempts: 5 });
      providerManager.sendWithFailover.mockResolvedValue(failedResult(false));

      await service.processClaimed(message);

      expect(queue.markDeadLetter).toHaveBeenCalledWith(message.id, 'boom', NOW);
      expect(queue.markDeferredForRetry).not.toHaveBeenCalled();
    });

    it('dead-letters once maxAttempts is reached even for a retryable failure category', async () => {
      const { service, queue, providerManager } = harness();
      const message = baseRecord({ attempts: 5, maxAttempts: 5 });
      providerManager.sendWithFailover.mockResolvedValue(failedResult(true));

      await service.processClaimed(message);

      expect(queue.markDeadLetter).toHaveBeenCalledWith(message.id, 'boom', NOW);
      expect(queue.markDeferredForRetry).not.toHaveBeenCalled();
    });
  });
});
