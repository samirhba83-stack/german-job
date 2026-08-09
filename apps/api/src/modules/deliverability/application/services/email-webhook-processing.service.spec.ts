import { EmailWebhookProcessingService } from './email-webhook-processing.service';
import { ResendWebhookVerificationError } from '../../infrastructure/webhooks/resend-webhook-verifier';
import { NormalizedWebhookEvent } from '../../domain/models/normalized-webhook-event';

/**
 * M31.1 Phase 10 — real, previously-missing coverage for this service, found during the
 * "Production Webhook Gate Review" (confirm PRODUCTION_WEBHOOK_PROCESSING_ENABLED=false really
 * blocks mutation) — no spec file existed for this service at all before this phase, despite it
 * being the real intake for 3 of this codebase's 4 webhook providers.
 */
function event(overrides: Partial<NormalizedWebhookEvent> = {}): NormalizedWebhookEvent {
  return {
    providerEventId: 'evt-1',
    providerMessageId: 'msg-1',
    eventType: 'DELIVERED',
    occurredAt: new Date('2026-08-08T00:00:00.000Z'),
    detail: '',
    clickedUrl: null,
    ...overrides,
  };
}

describe('EmailWebhookProcessingService', () => {
  function harness(productionWebhookProcessingEnabled: boolean) {
    const resendVerifier = { verify: jest.fn() };
    const sendgridVerifier = { verifyBatch: jest.fn() };
    const sesVerifier = { assertRealSnsHost: jest.fn(), verifySignature: jest.fn(), parse: jest.fn() };
    const webhookEvents = {
      findByProviderEventId: jest.fn().mockResolvedValue(null),
      recordReceived: jest.fn().mockResolvedValue('record-1'),
      markProcessed: jest.fn().mockResolvedValue(undefined),
      markRejected: jest.fn().mockResolvedValue(undefined),
    };
    const queue = { findByProviderMessageId: jest.fn().mockResolvedValue({ id: 'message-1' }) };
    const deliverability = {
      handleDelivered: jest.fn().mockResolvedValue(undefined),
      handleHardBounce: jest.fn().mockResolvedValue(undefined),
      handleSoftBounce: jest.fn().mockResolvedValue(undefined),
      handleComplaint: jest.fn().mockResolvedValue(undefined),
      handleOpened: jest.fn().mockResolvedValue(undefined),
      handleClicked: jest.fn().mockResolvedValue(undefined),
    };
    const clock = { now: () => new Date('2026-08-08T00:00:01.000Z') };
    const config = { get: jest.fn().mockReturnValue(productionWebhookProcessingEnabled) };
    const metrics = { incrementCounter: jest.fn(), recordGauge: jest.fn(), recordHistogram: jest.fn() };

    const service = new EmailWebhookProcessingService(
      resendVerifier as any,
      sendgridVerifier as any,
      sesVerifier as any,
      webhookEvents as any,
      queue as any,
      deliverability as any,
      clock as any,
      config as any,
      metrics as any,
    );
    return { service, resendVerifier, webhookEvents, queue, deliverability, metrics };
  }

  it('records and authenticates the event but does NOT mutate deliverability state when production webhook processing is disabled (the default)', async () => {
    const { service, resendVerifier, webhookEvents, deliverability, metrics } = harness(false);
    resendVerifier.verify.mockReturnValue(event());

    const outcome = await service.processResend(Buffer.from('{}'), {});

    expect(outcome).toBe('PROCESSING_DISABLED');
    expect(webhookEvents.recordReceived).toHaveBeenCalledTimes(1); // authenticated + durably recorded
    expect(deliverability.handleDelivered).not.toHaveBeenCalled(); // but never acted on
    expect(webhookEvents.markProcessed).not.toHaveBeenCalled();
    expect(metrics.incrementCounter).toHaveBeenCalledWith('email_webhook.outcome', { provider: 'resend', outcome: 'PROCESSING_DISABLED' });
  });

  it('processes and mutates deliverability state once production webhook processing is enabled', async () => {
    const { service, resendVerifier, webhookEvents, deliverability } = harness(true);
    resendVerifier.verify.mockReturnValue(event());

    const outcome = await service.processResend(Buffer.from('{}'), {});

    expect(outcome).toBe('PROCESSED');
    expect(deliverability.handleDelivered).toHaveBeenCalledTimes(1);
    expect(webhookEvents.markProcessed).toHaveBeenCalledTimes(1);
  });

  it('rejects a webhook with an invalid signature before ever checking the processing flag', async () => {
    const { service, resendVerifier, webhookEvents } = harness(true);
    resendVerifier.verify.mockImplementation(() => {
      throw new ResendWebhookVerificationError('bad signature');
    });

    const outcome = await service.processResend(Buffer.from('{}'), {});

    expect(outcome).toBe('REJECTED');
    expect(webhookEvents.markRejected).toHaveBeenCalledTimes(1);
  });

  it('reports DUPLICATE for an already-recorded provider event, regardless of the processing flag', async () => {
    const { service, resendVerifier, webhookEvents } = harness(true);
    resendVerifier.verify.mockReturnValue(event());
    webhookEvents.findByProviderEventId.mockResolvedValue({ status: 'PROCESSED' });

    const outcome = await service.processResend(Buffer.from('{}'), {});

    expect(outcome).toBe('DUPLICATE');
  });

  it('reports MESSAGE_NOT_FOUND when no queued message matches, before the processing flag is even consulted', async () => {
    const { service, resendVerifier, queue } = harness(false);
    resendVerifier.verify.mockReturnValue(event());
    queue.findByProviderMessageId.mockResolvedValue(null);

    const outcome = await service.processResend(Buffer.from('{}'), {});

    expect(outcome).toBe('MESSAGE_NOT_FOUND');
  });
});
