/**
 * What a given provider can and cannot do — read before composing a request so a caller (or a
 * future capability-aware strategy) can adapt without the abstraction itself ever hardcoding any
 * single provider's limits. Every future provider populates the same shape with its own values;
 * none of these fields assume a specific provider exists.
 */
export interface ProviderCapabilities {
  readonly providerId: string;
  readonly supportsAttachments: boolean;
  readonly supportsHtml: boolean;
  readonly supportsPlainText: boolean;
  /** Null when attachments aren't supported at all, or the limit isn't known. */
  readonly maxAttachmentSizeBytes: number | null;
  readonly maxRecipientsPerRequest: number;
  /** Null when unbounded or unknown. */
  readonly dailyDeliveryLimit: number | null;
  readonly requiresAuthentication: boolean;
  /** Open string list (e.g. 'OAUTH2', 'API_KEY', 'BASIC') — deliberately not an enum, so a
   * future provider's authentication method never requires changing this contract. */
  readonly supportedAuthenticationMethods: ReadonlyArray<string>;
}
