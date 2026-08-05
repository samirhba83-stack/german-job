/** Domain-level mirrors of the Prisma enums — plain TS unions, matching this codebase's
 * established precedent (never importing `@german-job-engine/database` generated types into a
 * domain layer). Every state here is justified by real, distinct behavior (M28.6 Phase 2):
 * PENDING (mid-OAuth-flow), CONNECTED (real, verified, usable), REAUTHORIZATION_REQUIRED (a
 * refresh failed in a way only re-consent fixes), REVOKED (the provider itself reported the grant
 * gone), USER_DISABLED (the user disconnected it), SYSTEM_SUSPENDED (this application paused it
 * for safety), FAILED (the connection attempt itself never completed). */
export type ConnectedMailboxProvider = 'GOOGLE_GMAIL' | 'MICROSOFT_OUTLOOK';

export type ConnectedMailboxStatus =
  | 'PENDING'
  | 'CONNECTED'
  | 'REAUTHORIZATION_REQUIRED'
  | 'REVOKED'
  | 'USER_DISABLED'
  | 'SYSTEM_SUSPENDED'
  | 'FAILED';

export type ConnectedMailboxFailureCategory = 'AUTHENTICATION' | 'SCOPE_REJECTED' | 'RATE_LIMITED' | 'PROVIDER_UNAVAILABLE' | 'REVOKED' | 'UNKNOWN';

/** M29 Phase 2 — a SEPARATE capability layer on the same mailbox row, deliberately not merged
 * into `ConnectedMailboxStatus` above (send-capability status and inbox-capability status answer
 * different questions and can legitimately disagree: a mailbox can be fully `CONNECTED` for
 * sending while `inboxCapabilityStatus` stays `NOT_REQUESTED` forever). NOT_REQUESTED is the
 * default and by far the most common state — most mailboxes never upgrade to inbox reading. */
export type InboxCapabilityStatus =
  | 'NOT_REQUESTED'
  | 'PENDING'
  | 'ACTIVE'
  | 'REAUTHORIZATION_REQUIRED'
  | 'REVOKED'
  | 'USER_DISABLED'
  | 'SYSTEM_SUSPENDED'
  | 'FAILED';

/**
 * The one provider-independent reference for "this user's connected mailbox." `encryptedRefreshToken`/
 * `encryptedAccessToken` are opaque, versioned ciphertext strings — this domain record NEVER
 * carries a decrypted token; only `MailboxTokenVaultService` (application layer) ever calls
 * `TokenVaultPort.decrypt()`, and only for the narrow purpose of making one real provider call.
 */
export interface ConnectedMailboxRecord {
  readonly id: string;
  readonly userId: string;
  readonly provider: ConnectedMailboxProvider;
  readonly providerAccountId: string;
  readonly emailAddress: string;
  readonly displayName: string | null;
  readonly isActive: boolean;
  readonly status: ConnectedMailboxStatus;
  readonly grantedScopes: ReadonlyArray<string>;

  readonly tokenEncryptionVersion: number | null;
  readonly encryptedRefreshToken: string | null;
  readonly encryptedAccessToken: string | null;
  readonly accessTokenExpiresAt: Date | null;
  readonly hasRefreshToken: boolean;

  readonly connectedAt: Date | null;
  readonly lastRefreshedAt: Date | null;
  readonly lastSuccessfulSendAt: Date | null;
  readonly lastFailureAt: Date | null;
  readonly failureCategory: ConnectedMailboxFailureCategory | null;
  readonly failureReason: string | null;

  readonly reauthorizationRequired: boolean;
  readonly userDisabled: boolean;
  readonly systemSuspended: boolean;
  readonly suspensionReason: string | null;

  readonly dailySendCount: number;
  readonly dailySendCountResetAt: Date | null;
  readonly rollingSendCount: number;
  readonly rollingWindowStartedAt: Date | null;
  readonly providerDailyLimit: number | null;

  readonly consentVersion: string | null;
  readonly consentAcceptedAt: Date | null;

  // ---------- M29 — Inbox Intelligence capability (separate from every field above) ----------
  readonly inboxCapabilityStatus: InboxCapabilityStatus;
  readonly inboxGrantedScopes: ReadonlyArray<string>;
  readonly inboxConsentVersion: string | null;
  readonly inboxConsentAcceptedAt: Date | null;
  readonly inboxRevokedAt: Date | null;
  readonly lastSuccessfulInboxAccessAt: Date | null;
  readonly inboxReauthorizationRequired: boolean;
  readonly inboxUserDisabled: boolean;
  readonly inboxSystemSuspended: boolean;
  readonly inboxSuspensionReason: string | null;
  readonly inboxFailureCategory: ConnectedMailboxFailureCategory | null;
  readonly inboxFailureReason: string | null;

  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateConnectedMailboxInput {
  readonly userId: string;
  readonly provider: ConnectedMailboxProvider;
  readonly providerAccountId: string;
  readonly emailAddress: string;
  readonly displayName: string | null;
  readonly grantedScopes: ReadonlyArray<string>;
  readonly encryptedRefreshToken: string | null;
  readonly encryptedAccessToken: string | null;
  readonly accessTokenExpiresAt: Date | null;
  readonly tokenEncryptionVersion: number | null;
  readonly hasRefreshToken: boolean;
  readonly consentVersion: string;
}

/** A generic, partial patch — every field optional, only supplied fields are ever written.
 * Matches the established "explicit patch object, not a full-entity PUT" persistence idiom
 * already used by `EmailQueueRepository`'s many narrow `mark*` methods (M28), just consolidated
 * into one method here since `ConnectedMailbox` has many more independently-updatable facets. */
export interface ConnectedMailboxUpdatePatch {
  readonly status?: ConnectedMailboxStatus;
  readonly isActive?: boolean;
  readonly grantedScopes?: ReadonlyArray<string>;
  readonly encryptedRefreshToken?: string | null;
  readonly encryptedAccessToken?: string | null;
  readonly accessTokenExpiresAt?: Date | null;
  readonly tokenEncryptionVersion?: number | null;
  readonly hasRefreshToken?: boolean;
  readonly lastRefreshedAt?: Date;
  readonly lastSuccessfulSendAt?: Date;
  readonly lastFailureAt?: Date;
  readonly failureCategory?: ConnectedMailboxFailureCategory | null;
  readonly failureReason?: string | null;
  readonly reauthorizationRequired?: boolean;
  readonly userDisabled?: boolean;
  readonly systemSuspended?: boolean;
  readonly suspensionReason?: string | null;
  readonly dailySendCount?: number;
  readonly dailySendCountResetAt?: Date | null;
  readonly rollingSendCount?: number;
  readonly rollingWindowStartedAt?: Date | null;

  readonly inboxCapabilityStatus?: InboxCapabilityStatus;
  readonly inboxGrantedScopes?: ReadonlyArray<string>;
  readonly inboxConsentVersion?: string | null;
  readonly inboxConsentAcceptedAt?: Date | null;
  readonly inboxRevokedAt?: Date | null;
  readonly lastSuccessfulInboxAccessAt?: Date | null;
  readonly inboxReauthorizationRequired?: boolean;
  readonly inboxUserDisabled?: boolean;
  readonly inboxSystemSuspended?: boolean;
  readonly inboxSuspensionReason?: string | null;
  readonly inboxFailureCategory?: ConnectedMailboxFailureCategory | null;
  readonly inboxFailureReason?: string | null;
}
