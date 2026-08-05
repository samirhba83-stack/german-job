export type DisplayNameSource = 'EMAIL_LOCAL_PART' | 'NOT_AVAILABLE';

/**
 * The candidate side of the outbound application. UserProfile/User carry no
 * standalone "name" field today, so displayName is honestly derived rather
 * than invented — displayNameSource records exactly how, for explainability.
 */
export interface CandidateIdentity {
  readonly displayName: string;
  readonly emailAddress: string;
  readonly displayNameSource: DisplayNameSource;
}
