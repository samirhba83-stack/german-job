import { randomUUID, createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  PaymentProviderPort,
  ProviderCheckoutSession,
  ProviderCustomer,
  ProviderInvoice,
  ProviderRefundResult,
  ProviderSubscriptionState,
  VerifiedWebhookEvent,
  WebhookVerificationError,
} from '../../../domain/ports/payment-provider.port';

/**
 * Deterministic, fully in-memory, zero-network fake for automated tests (Phase 3: "Retain a
 * safe fake or sandbox adapter for automated tests"). Never calls any real API — every test
 * using this adapter is guaranteed to never create a real charge, regardless of environment
 * configuration. `signWebhook` lets a test construct a genuinely-valid signed payload using the
 * same HMAC scheme the real PaddlePaymentAdapter verifies, so webhook-security tests exercise
 * real signature logic without a live Paddle sandbox call.
 */
@Injectable()
export class FakePaymentProviderAdapter implements PaymentProviderPort {
  private readonly customers = new Map<string, string>();
  private readonly subscriptions = new Map<string, ProviderSubscriptionState>();
  readonly webhookSecret = 'fake-webhook-secret-for-tests';

  async resolveOrCreateCustomer(params: { email: string; existingProviderCustomerId: string | null }): Promise<ProviderCustomer> {
    if (params.existingProviderCustomerId) {
      return { providerCustomerId: params.existingProviderCustomerId };
    }
    const existing = this.customers.get(params.email);
    if (existing) {
      return { providerCustomerId: existing };
    }
    const id = `fake_cus_${randomUUID()}`;
    this.customers.set(params.email, id);
    return { providerCustomerId: id };
  }

  async createCheckoutSession(): Promise<ProviderCheckoutSession> {
    return { providerCheckoutUrl: `https://sandbox-checkout.paddle.test/${randomUUID()}`, providerTransactionId: `fake_txn_${randomUUID()}` };
  }

  async getSubscriptionState(providerSubscriptionId: string): Promise<ProviderSubscriptionState | null> {
    return this.subscriptions.get(providerSubscriptionId) ?? null;
  }

  async cancelSubscription(providerSubscriptionId: string): Promise<void> {
    const existing = this.subscriptions.get(providerSubscriptionId);
    if (existing) {
      this.subscriptions.set(providerSubscriptionId, { ...existing, status: 'canceled' });
    }
  }

  async resumeScheduledCancellation(): Promise<void> {
    // no-op in the fake — nothing tracks "scheduled to cancel" separately from `status` here.
  }

  async changeSubscriptionPlan(providerSubscriptionId: string, newProviderPriceId: string): Promise<ProviderSubscriptionState> {
    const existing = this.subscriptions.get(providerSubscriptionId);
    if (!existing) {
      throw new Error(`Fake subscription ${providerSubscriptionId} not found.`);
    }
    const updated = { ...existing, providerPriceId: newProviderPriceId };
    this.subscriptions.set(providerSubscriptionId, updated);
    return updated;
  }

  async issueRefund(): Promise<ProviderRefundResult> {
    return { providerRefundId: `fake_ref_${randomUUID()}`, status: 'approved' };
  }

  async getInvoice(providerTransactionId: string): Promise<ProviderInvoice | null> {
    return {
      providerInvoiceId: providerTransactionId,
      amountCents: 4900,
      currency: 'EUR',
      issuedAt: new Date(),
      downloadUrl: null,
    };
  }

  verifyAndParseWebhook(rawBody: Buffer, signatureHeader: string | undefined): VerifiedWebhookEvent {
    if (!signatureHeader) {
      throw new WebhookVerificationError('missing signature header');
    }
    const parts = new Map(signatureHeader.split(';').map((s) => s.split('=') as [string, string]));
    const timestamp = parts.get('ts');
    const providedHash = parts.get('h1');
    if (!timestamp || !providedHash) {
      throw new WebhookVerificationError('malformed signature header');
    }
    const expected = createHmac('sha256', this.webhookSecret).update(`${timestamp}:${rawBody.toString('utf8')}`).digest('hex');
    if (expected !== providedHash) {
      throw new WebhookVerificationError('signature mismatch');
    }
    const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (ageSeconds > 300) {
      throw new WebhookVerificationError(`timestamp outside tolerance window (${ageSeconds.toFixed(0)}s)`);
    }

    const parsed = JSON.parse(rawBody.toString('utf8')) as { event_id: string; event_type: string; occurred_at?: string; data?: Record<string, unknown> };
    return {
      providerEventId: parsed.event_id,
      eventType: parsed.event_type,
      occurredAt: new Date(parsed.occurred_at ?? Date.now()),
      data: parsed.data ?? {},
    };
  }

  /** Test helper — registers a subscription state this fake will return from
   * getSubscriptionState(), so tests can simulate an existing Paddle subscription without a
   * network call. */
  seedSubscription(state: ProviderSubscriptionState): void {
    this.subscriptions.set(state.providerSubscriptionId, state);
  }

  /** Test helper — builds a real, validly-signed webhook payload + header pair using this
   * fake's own secret, so tests exercise the actual signature-verification code path. */
  signWebhook(payload: Record<string, unknown>): { rawBody: Buffer; signatureHeader: string } {
    const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');
    const ts = Math.floor(Date.now() / 1000).toString();
    const hash = createHmac('sha256', this.webhookSecret).update(`${ts}:${rawBody.toString('utf8')}`).digest('hex');
    return { rawBody, signatureHeader: `ts=${ts};h1=${hash}` };
  }
}
