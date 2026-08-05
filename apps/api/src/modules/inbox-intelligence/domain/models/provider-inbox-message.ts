/** M29 Phase 4 — the raw, provider-shaped payload `ConnectedInboxProviderPort.fetchMessageContent()`
 * returns, before any normalization. Deliberately close to the wire format (both providers'
 * concepts map onto this cleanly) — `ContentNormalizerService` (Phase 8) is the one place this
 * becomes the internal `NormalizedInboxMessage` shape. */
export interface ProviderInboxMessageMetadata {
  readonly providerMessageId: string;
  readonly providerThreadId: string | null;
  readonly rfcMessageId: string | null;
  readonly inReplyTo: string | null;
  readonly referencesHeaders: ReadonlyArray<string>;
  readonly fromAddress: string;
  readonly fromDisplayName: string | null;
  readonly toAddresses: ReadonlyArray<string>;
  readonly subject: string;
  readonly receivedAt: Date;
  readonly sizeEstimateBytes: number;
  /** Real provider auto-reply/delivery-failure signals, read directly off provider-supplied
   * headers/labels — never inferred from body text alone when the provider already says so
   * (Phase 10: "known provider auto-response formats"). */
  readonly isAutoReplyHeaderPresent: boolean;
  readonly isDeliveryFailureHeaderPresent: boolean;
}

export interface ProviderInboxMessageContent {
  readonly metadata: ProviderInboxMessageMetadata;
  readonly plainTextBody: string | null;
  readonly htmlBody: string | null;
  readonly hasCalendarInvite: boolean;
  readonly attachmentMetadata: ReadonlyArray<ProviderInboxAttachmentMetadata>;
}

/** Metadata only — M29 never automatically downloads/stores an attachment's bytes (Phase 7:
 * "never store unrelated attachments automatically"). */
export interface ProviderInboxAttachmentMetadata {
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
}

export interface ChangedMessageRef {
  readonly providerMessageId: string;
  readonly providerThreadId: string | null;
}
