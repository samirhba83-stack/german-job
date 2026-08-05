export interface ProviderRejection {
  readonly providerId: string;
  readonly reasonCode: string;
  readonly explanation: string;
}
