export type NormalizedWebhookEventType = 'DELIVERED' | 'BOUNCE_HARD' | 'BOUNCE_SOFT' | 'COMPLAINT' | 'OPEN' | 'CLICK' | 'OTHER';

/** The one shape every provider's own webhook payload gets translated into before any
 * deliverability logic runs — mirrors `DeliveryStatus`'s own "nothing outside the adapter should
 * ever see a provider-specific shape" doctrine, applied to inbound events instead of outbound
 * requests. */
export interface NormalizedWebhookEvent {
  readonly providerEventId: string;
  readonly providerMessageId: string;
  readonly eventType: NormalizedWebhookEventType;
  readonly occurredAt: Date;
  readonly detail: string;
  readonly clickedUrl: string | null;
}
