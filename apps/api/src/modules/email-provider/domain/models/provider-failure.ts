/** Provider-independent failure taxonomy — every provider adapter maps its own error shape
 * (SMTP reply codes, a REST API's error body, ...) onto one of these categories. */
export type ProviderFailureCategory =
  | 'AUTHENTICATION'
  | 'RATE_LIMITED'
  | 'INVALID_RECIPIENT'
  | 'UNSUPPORTED_CAPABILITY'
  | 'PROVIDER_UNAVAILABLE'
  | 'UNKNOWN';

export interface ProviderFailure {
  readonly category: ProviderFailureCategory;
  readonly message: string;
  /** Whether retrying the same request could plausibly succeed later. */
  readonly retryable: boolean;
}
