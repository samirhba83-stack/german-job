/** The company side of the outbound application. */
export interface RecipientIdentity {
  readonly displayName: string;
  readonly emailAddress: string;
  readonly companyName: string;
}
