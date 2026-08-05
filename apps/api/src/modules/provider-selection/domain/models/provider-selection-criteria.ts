/** What a pending delivery needs from whichever provider handles it — derived from an
 * EmailDeliveryRequest, never from any specific provider's own shape. */
export interface ProviderSelectionCriteria {
  readonly requiresAttachments: boolean;
  readonly requiresHtml: boolean;
  readonly requiresPlainText: boolean;
  readonly recipientCount: number;
  /** Threaded from the originating task when the caller has one in scope (M18) — null for a standalone selectProvider() call with no execution context. */
  readonly correlationId: string | null;
  readonly traceId: string | null;
}
