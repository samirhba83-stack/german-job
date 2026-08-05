import { createHmac, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentProviderPort,
  ProviderCheckoutSession,
  ProviderCustomer,
  ProviderInvoice,
  ProviderRefundResult,
  ProviderSubscriptionLifecycleStatus,
  ProviderSubscriptionState,
  VerifiedWebhookEvent,
  WebhookVerificationError,
} from '../../../domain/ports/payment-provider.port';

/**
 * Real Paddle Billing (API v2) adapter — sandbox by default (see billing.config.ts;
 * `environment` selects the base URL, `productionPaymentsEnabled` is checked separately by
 * `BillingProductionSafetyService` before any operation that could create a real charge —
 * checkout and plan-change — is even reached).
 *
 * Deliberately hand-rolled against Paddle's plain REST API with the platform's native `fetch`
 * and `node:crypto`, rather than adding the `@paddle/paddle-node-sdk` package — this is a
 * payments-security-sensitive adapter; keeping it dependency-free and fully auditable in one
 * file was judged the safer choice than trusting a third-party SDK's supply chain for a
 * Sandbox-only milestone. Revisit if/when production activation makes the SDK's additional
 * features (typed webhooks, retries) worth the added dependency surface.
 */
@Injectable()
export class PaddlePaymentAdapter implements PaymentProviderPort {
  private readonly logger = new Logger(PaddlePaymentAdapter.name);

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  private get baseUrl(): string {
    return this.config.get<string>('billing.environment') === 'production'
      ? 'https://api.paddle.com'
      : 'https://sandbox-api.paddle.com';
  }

  private get apiKey(): string {
    return this.config.get<string>('billing.apiKey', '');
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    if (!this.apiKey) {
      throw new Error('PADDLE_API_KEY is not configured — cannot call the Paddle API.');
    }
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = (await response.json().catch(() => null)) as { data?: T; error?: { detail?: string } } | null;
    if (!response.ok) {
      const detail = json?.error?.detail ?? response.statusText;
      throw new Error(`Paddle API ${method} ${path} failed (${response.status}): ${detail}`);
    }
    return (json?.data ?? json) as T;
  }

  async resolveOrCreateCustomer(params: { email: string; existingProviderCustomerId: string | null }): Promise<ProviderCustomer> {
    if (params.existingProviderCustomerId) {
      return { providerCustomerId: params.existingProviderCustomerId };
    }

    const existing = await this.request<{ id: string }[]>('GET', `/customers?email=${encodeURIComponent(params.email)}`).catch(
      () => [],
    );
    if (existing.length > 0) {
      return { providerCustomerId: existing[0].id };
    }

    const created = await this.request<{ id: string }>('POST', '/customers', { email: params.email });
    return { providerCustomerId: created.id };
  }

  async createCheckoutSession(params: {
    providerCustomerId: string;
    providerPriceId: string;
    idempotencyKey: string;
    successUrl: string;
    cancelUrl: string;
    metadata: Readonly<Record<string, string>>;
  }): Promise<ProviderCheckoutSession> {
    const transaction = await this.request<{ id: string; checkout?: { url?: string } }>(
      'POST',
      '/transactions',
      {
        items: [{ price_id: params.providerPriceId, quantity: 1 }],
        customer_id: params.providerCustomerId,
        custom_data: params.metadata,
        checkout: { url: params.successUrl },
      },
    );

    if (!transaction.checkout?.url) {
      throw new Error('Paddle did not return a checkout URL — verify hosted checkout is enabled for this Paddle account.');
    }

    return { providerCheckoutUrl: transaction.checkout.url, providerTransactionId: transaction.id };
  }

  async getSubscriptionState(providerSubscriptionId: string): Promise<ProviderSubscriptionState | null> {
    const sub = await this.request<{
      id: string;
      status: string;
      current_billing_period?: { starts_at: string; ends_at: string };
      items: { price: { id: string } }[];
    } | null>('GET', `/subscriptions/${providerSubscriptionId}`).catch(() => null);

    if (!sub) {
      return null;
    }

    return {
      providerSubscriptionId: sub.id,
      status: this.mapStatus(sub.status),
      currentPeriodStart: new Date(sub.current_billing_period?.starts_at ?? Date.now()),
      currentPeriodEnd: new Date(sub.current_billing_period?.ends_at ?? Date.now()),
      providerPriceId: sub.items[0]?.price?.id ?? '',
    };
  }

  async cancelSubscription(providerSubscriptionId: string, atPeriodEnd: boolean): Promise<void> {
    await this.request('POST', `/subscriptions/${providerSubscriptionId}/cancel`, {
      effective_from: atPeriodEnd ? 'next_billing_period' : 'immediately',
    });
  }

  async resumeScheduledCancellation(providerSubscriptionId: string): Promise<void> {
    await this.request('PATCH', `/subscriptions/${providerSubscriptionId}`, { scheduled_change: null });
  }

  async changeSubscriptionPlan(providerSubscriptionId: string, newProviderPriceId: string): Promise<ProviderSubscriptionState> {
    await this.request('PATCH', `/subscriptions/${providerSubscriptionId}`, {
      items: [{ price_id: newProviderPriceId, quantity: 1 }],
      proration_billing_mode: 'prorated_immediately',
    });
    const state = await this.getSubscriptionState(providerSubscriptionId);
    if (!state) {
      throw new Error(`Paddle subscription ${providerSubscriptionId} not found after plan change.`);
    }
    return state;
  }

  async issueRefund(params: { providerTransactionId: string; amountCents: number; reason: string }): Promise<ProviderRefundResult> {
    const adjustment = await this.request<{ id: string; status: string }>('POST', '/adjustments', {
      action: 'refund',
      transaction_id: params.providerTransactionId,
      reason: params.reason,
      items: [{ type: 'full' }],
    });
    return { providerRefundId: adjustment.id, status: adjustment.status };
  }

  async getInvoice(providerTransactionId: string): Promise<ProviderInvoice | null> {
    const [transaction, invoice] = await Promise.all([
      this.request<{ id: string; details?: { totals?: { total: string; currency_code: string } }; billed_at?: string }>(
        'GET',
        `/transactions/${providerTransactionId}`,
      ).catch(() => null),
      this.request<{ url: string }>('GET', `/transactions/${providerTransactionId}/invoice`).catch(() => null),
    ]);

    if (!transaction) {
      return null;
    }

    return {
      providerInvoiceId: transaction.id,
      amountCents: Number(transaction.details?.totals?.total ?? 0),
      currency: transaction.details?.totals?.currency_code ?? 'EUR',
      issuedAt: new Date(transaction.billed_at ?? Date.now()),
      downloadUrl: invoice?.url ?? null,
    };
  }

  /**
   * Paddle's real signing scheme: header `Paddle-Signature: ts=<unix_seconds>;h1=<hex_hmac>`.
   * Signed content is `${ts}:${rawBody}`, HMAC-SHA256 with the webhook secret. Verified with a
   * constant-time comparison (never `===` on secret-derived hex, to avoid a timing side
   * channel), and the timestamp is checked against a tolerance window to reject replayed-but-
   * validly-signed old payloads (Phase 5: "timestamp tolerance", "replay protection").
   */
  verifyAndParseWebhook(rawBody: Buffer, signatureHeader: string | undefined): VerifiedWebhookEvent {
    if (!signatureHeader) {
      throw new WebhookVerificationError('missing Paddle-Signature header');
    }

    const secret = this.config.get<string>('billing.webhookSecret', '');
    if (!secret) {
      throw new WebhookVerificationError('PADDLE_WEBHOOK_SECRET is not configured');
    }

    const parts = new Map(
      signatureHeader.split(';').map((segment) => {
        const [key, value] = segment.split('=');
        return [key, value] as const;
      }),
    );
    const timestamp = parts.get('ts');
    const providedHash = parts.get('h1');
    if (!timestamp || !providedHash) {
      throw new WebhookVerificationError('malformed Paddle-Signature header');
    }

    const toleranceSeconds = this.config.get<number>('billing.webhookToleranceSeconds', 300);
    const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(ageSeconds) || ageSeconds > toleranceSeconds) {
      throw new WebhookVerificationError(`timestamp outside tolerance window (${ageSeconds.toFixed(0)}s)`);
    }

    const expectedHash = createHmac('sha256', secret).update(`${timestamp}:${rawBody.toString('utf8')}`).digest('hex');
    const expectedBuffer = Buffer.from(expectedHash, 'hex');
    const providedBuffer = Buffer.from(providedHash, 'hex');
    if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) {
      throw new WebhookVerificationError('signature mismatch');
    }

    let parsed: { event_id?: string; event_type?: string; occurred_at?: string; data?: Record<string, unknown> };
    try {
      parsed = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new WebhookVerificationError('body is not valid JSON');
    }

    if (!parsed.event_id || !parsed.event_type) {
      throw new WebhookVerificationError('missing event_id or event_type');
    }

    return {
      providerEventId: parsed.event_id,
      eventType: parsed.event_type,
      occurredAt: new Date(parsed.occurred_at ?? Date.now()),
      data: parsed.data ?? {},
    };
  }

  private mapStatus(paddleStatus: string): ProviderSubscriptionLifecycleStatus {
    switch (paddleStatus) {
      case 'active':
        return 'active';
      case 'past_due':
        return 'past_due';
      case 'paused':
        return 'paused';
      case 'trialing':
        return 'trialing';
      default:
        this.logger.warn(`Unrecognized Paddle subscription status "${paddleStatus}" — mapping to "canceled".`);
        return 'canceled';
    }
  }
}
