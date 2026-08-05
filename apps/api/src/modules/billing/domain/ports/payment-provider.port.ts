export const PAYMENT_PROVIDER_PORT = Symbol('PAYMENT_PROVIDER_PORT');

/**
 * M27 Phase 3 — the provider-independent boundary. Nothing outside
 * infrastructure/payment-providers/ ever imports a Paddle-specific type or calls the Paddle API
 * directly; every other layer (checkout, webhook processing, refunds, cancellation) depends only
 * on this port. Swapping providers later means writing one new adapter class, never touching the
 * application or domain layers.
 */

export interface ProviderCustomer {
  readonly providerCustomerId: string;
}

export interface ProviderCheckoutSession {
  readonly providerCheckoutUrl: string;
  /** Paddle returns this immediately on transaction creation, before any payment happens — the
   * real correlation key stored on CheckoutSession so the later `transaction.completed` webhook
   * can be linked back to this exact checkout without trusting anything from the client. */
  readonly providerTransactionId: string;
}

export type ProviderSubscriptionLifecycleStatus = 'active' | 'past_due' | 'canceled' | 'paused' | 'trialing';

export interface ProviderSubscriptionState {
  readonly providerSubscriptionId: string;
  readonly status: ProviderSubscriptionLifecycleStatus;
  readonly currentPeriodStart: Date;
  readonly currentPeriodEnd: Date;
  readonly providerPriceId: string;
}

export interface ProviderRefundResult {
  readonly providerRefundId: string;
  readonly status: string;
}

export interface ProviderInvoice {
  readonly providerInvoiceId: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly issuedAt: Date;
  readonly downloadUrl: string | null;
}

/** The result of verifying + parsing an inbound webhook — `data` is the provider's own parsed
 * JSON body, still provider-shaped; the webhook processing service translates it into internal
 * billing concepts, never this port itself (matches "the rest of the application must use
 * internal billing concepts"). */
export interface VerifiedWebhookEvent {
  readonly providerEventId: string;
  readonly eventType: string;
  readonly occurredAt: Date;
  readonly data: Record<string, unknown>;
}

export class WebhookVerificationError extends Error {
  constructor(reason: string) {
    super(`Webhook verification failed: ${reason}`);
    this.name = 'WebhookVerificationError';
  }
}

export interface PaymentProviderPort {
  /** Creates a provider customer if none exists yet for this user, or returns the existing one
   * unchanged — Phase 4: "creates or resolves a provider customer safely." */
  resolveOrCreateCustomer(params: { email: string; existingProviderCustomerId: string | null }): Promise<ProviderCustomer>;

  /** Server-side-trusted pricing only — the caller resolves `providerPriceId` from the internal
   * plan catalogue's price-id mapping, never from client input. */
  createCheckoutSession(params: {
    providerCustomerId: string;
    providerPriceId: string;
    idempotencyKey: string;
    successUrl: string;
    cancelUrl: string;
    metadata: Readonly<Record<string, string>>;
  }): Promise<ProviderCheckoutSession>;

  getSubscriptionState(providerSubscriptionId: string): Promise<ProviderSubscriptionState | null>;

  cancelSubscription(providerSubscriptionId: string, atPeriodEnd: boolean): Promise<void>;

  /** Clears a pending "cancel at period end" scheduled change — the real Paddle operation is
   * PATCH /subscriptions/{id} with scheduled_change: null. Only valid while nothing has actually
   * been canceled yet (the whole point of "at period end" is that the real cancellation hasn't
   * happened, so there's something to undo). */
  resumeScheduledCancellation(providerSubscriptionId: string): Promise<void>;

  changeSubscriptionPlan(providerSubscriptionId: string, newProviderPriceId: string): Promise<ProviderSubscriptionState>;

  issueRefund(params: { providerTransactionId: string; amountCents: number; reason: string }): Promise<ProviderRefundResult>;

  getInvoice(providerTransactionId: string): Promise<ProviderInvoice | null>;

  /** Verifies the signature (never trusts an unsigned or badly-signed payload — throws
   * WebhookVerificationError) and parses the body. Callers must pass the RAW request body,
   * never a re-serialized JSON object, since signature verification is byte-exact. */
  verifyAndParseWebhook(rawBody: Buffer, signatureHeader: string | undefined): VerifiedWebhookEvent;
}
