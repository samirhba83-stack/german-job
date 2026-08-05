import { PlanCode } from '@german-job-engine/shared-types';
import { WebhookProcessingService } from './webhook-processing.service';
import { PaymentProviderPort, VerifiedWebhookEvent, WebhookVerificationError } from '../../domain/ports/payment-provider.port';
import { Subscription } from '../../domain/entities/subscription.entity';

function buildService(overrides: {
  paymentProvider?: Partial<PaymentProviderPort>;
  webhookEventRepository?: Partial<Record<string, jest.Mock>>;
  subscriptionRepository?: Partial<Record<string, jest.Mock>>;
} = {}) {
  const paymentProvider = {
    verifyAndParseWebhook: jest.fn(),
    ...overrides.paymentProvider,
  } as unknown as PaymentProviderPort;

  const webhookEventRepository = {
    findByProviderEventId: jest.fn().mockResolvedValue(null),
    recordReceived: jest.fn().mockResolvedValue('webhook_event_row_1'),
    markProcessed: jest.fn().mockResolvedValue(undefined),
    markRejected: jest.fn().mockResolvedValue(undefined),
    markDeadLetter: jest.fn().mockResolvedValue(undefined),
    ...overrides.webhookEventRepository,
  };

  const checkoutSessionRepository = {
    findOpenByUserId: jest.fn().mockResolvedValue(null),
    markCompleted: jest.fn().mockResolvedValue(undefined),
  };

  const subscriptionRepository = {
    findByPaddleSubscriptionId: jest.fn().mockResolvedValue(null),
    findCurrentByUserId: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides.subscriptionRepository,
  };

  const refundRepository = {
    findByUserId: jest.fn().mockResolvedValue([]),
    markIssued: jest.fn().mockResolvedValue(undefined),
  };

  const ledger = { record: jest.fn().mockResolvedValue(undefined) };
  const userRepository = { findById: jest.fn().mockResolvedValue(null) };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };

  const service = new WebhookProcessingService(
    paymentProvider,
    webhookEventRepository as never,
    checkoutSessionRepository as never,
    subscriptionRepository as never,
    refundRepository as never,
    ledger as never,
    userRepository as never,
    notifications as never,
  );

  return { service, paymentProvider, webhookEventRepository, checkoutSessionRepository, subscriptionRepository, refundRepository, ledger, userRepository };
}

function verifiedEvent(overrides: Partial<VerifiedWebhookEvent> = {}): VerifiedWebhookEvent {
  return {
    providerEventId: 'evt_1',
    eventType: 'subscription.activated',
    occurredAt: new Date('2026-07-30T00:00:00.000Z'),
    data: {},
    ...overrides,
  };
}

describe('WebhookProcessingService.processWebhook', () => {
  it('returns REJECTED and records a failed ledger entry when signature verification fails — never reaches dispatch logic', async () => {
    const { service, webhookEventRepository, ledger, subscriptionRepository } = buildService({
      paymentProvider: {
        verifyAndParseWebhook: jest.fn().mockImplementation(() => {
          throw new WebhookVerificationError('signature mismatch');
        }),
      },
    });

    const outcome = await service.processWebhook(Buffer.from('{}'), 'ts=1;h1=deadbeef');

    expect(outcome).toBe('REJECTED');
    expect(webhookEventRepository.recordReceived).toHaveBeenCalledWith(
      expect.objectContaining({ signatureValid: false }),
    );
    expect(ledger.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'WEBHOOK_RECEIVED', status: 'FAILURE' }));
    expect(subscriptionRepository.save).not.toHaveBeenCalled();
  });

  it('returns DUPLICATE and never calls dispatch/save again for a providerEventId already recorded (redelivery)', async () => {
    const { service, webhookEventRepository, subscriptionRepository } = buildService({
      paymentProvider: { verifyAndParseWebhook: jest.fn().mockReturnValue(verifiedEvent()) },
      webhookEventRepository: {
        findByProviderEventId: jest.fn().mockResolvedValue({ id: 'existing_row', status: 'PROCESSED' }),
      },
    });

    const outcome = await service.processWebhook(Buffer.from('{}'), 'ts=1;h1=abc');

    expect(outcome).toBe('DUPLICATE');
    expect(webhookEventRepository.recordReceived).not.toHaveBeenCalled();
    expect(subscriptionRepository.save).not.toHaveBeenCalled();
  });

  it('returns IGNORED_UNKNOWN_TYPE for an event type not in the allowlist, leaving the row at RECEIVED (not marked processed)', async () => {
    const { service, webhookEventRepository } = buildService({
      paymentProvider: {
        verifyAndParseWebhook: jest.fn().mockReturnValue(verifiedEvent({ eventType: 'customer.updated' })),
      },
    });

    const outcome = await service.processWebhook(Buffer.from('{}'), 'ts=1;h1=abc');

    expect(outcome).toBe('IGNORED_UNKNOWN_TYPE');
    expect(webhookEventRepository.markProcessed).not.toHaveBeenCalled();
  });

  it('creates a new Subscription and records ACTIVATED + ENTITLEMENT_GRANTED ledger entries for a fresh subscription.activated', async () => {
    const { service, subscriptionRepository, ledger, webhookEventRepository } = buildService({
      paymentProvider: {
        verifyAndParseWebhook: jest.fn().mockReturnValue(
          verifiedEvent({
            eventType: 'subscription.activated',
            providerEventId: 'evt_activate_1',
            data: {
              id: 'paddle_sub_new',
              customer_id: 'paddle_cust_new',
              current_billing_period: { starts_at: '2026-07-01T00:00:00.000Z', ends_at: '2026-08-01T00:00:00.000Z' },
              items: [{ price: { id: 'pri_professional' } }],
              custom_data: { userId: 'user_1', planCode: PlanCode.PROFESSIONAL },
            },
          }),
        ),
      },
    });

    const outcome = await service.processWebhook(Buffer.from('{}'), 'ts=1;h1=abc');

    expect(outcome).toBe('PROCESSED');
    expect(subscriptionRepository.save).toHaveBeenCalledTimes(1);
    const saved = subscriptionRepository.save.mock.calls[0][0] as Subscription;
    expect(saved.userId).toBe('user_1');
    expect(saved.planCode).toBe(PlanCode.PROFESSIONAL);
    expect(saved.status).toBe('ACTIVE');
    expect(ledger.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'SUBSCRIPTION_ACTIVATED' }));
    expect(ledger.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'ENTITLEMENT_GRANTED' }));
    expect(webhookEventRepository.markProcessed).toHaveBeenCalledWith('webhook_event_row_1', expect.any(Date));
  });

  it('treats subscription.activated as an idempotent no-op when a Subscription for that paddleSubscriptionId already exists (business-level idempotency, independent of WebhookEvent dedup)', async () => {
    const { service, subscriptionRepository } = buildService({
      paymentProvider: {
        verifyAndParseWebhook: jest.fn().mockReturnValue(
          verifiedEvent({
            eventType: 'subscription.activated',
            data: { id: 'paddle_sub_existing', customer_id: 'paddle_cust', items: [], custom_data: { userId: 'user_1', planCode: PlanCode.PROFESSIONAL } },
          }),
        ),
      },
      subscriptionRepository: {
        findByPaddleSubscriptionId: jest.fn().mockResolvedValue(
          Subscription.activate('existing_id', {
            userId: 'user_1',
            planCode: PlanCode.PROFESSIONAL,
            paddleSubscriptionId: 'paddle_sub_existing',
            paddleCustomerId: 'paddle_cust',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(),
          }),
        ),
      },
    });

    const outcome = await service.processWebhook(Buffer.from('{}'), 'ts=1;h1=abc');

    expect(outcome).toBe('PROCESSED');
    expect(subscriptionRepository.save).not.toHaveBeenCalled();
  });

  it('rejects (throws) subscription.activated with no usable custom_data — refuses to guess which user to grant entitlement to', async () => {
    const { service } = buildService({
      paymentProvider: {
        verifyAndParseWebhook: jest.fn().mockReturnValue(
          verifiedEvent({
            eventType: 'subscription.activated',
            data: { id: 'paddle_sub_x', customer_id: 'paddle_cust_x', items: [], custom_data: null },
          }),
        ),
      },
    });

    await expect(service.processWebhook(Buffer.from('{}'), 'ts=1;h1=abc')).rejects.toThrow();
  });
});
