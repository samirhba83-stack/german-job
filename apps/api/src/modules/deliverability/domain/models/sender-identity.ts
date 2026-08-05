export type SenderVerificationStatus = 'UNCONFIGURED' | 'PENDING' | 'VERIFIED' | 'FAILED' | 'SUSPENDED';

/**
 * M28.5 Phase 9 — a verified, platform-managed sending identity. Domain truth, never a raw
 * provider status string passed through unmodified (Phase 9: "Do not use provider raw status
 * strings as domain truth") — `verificationStatus`/`dkimVerified`/`spfReady`/`dmarcReady` are this
 * application's own considered judgment, informed by (but not a blind copy of) whatever a
 * provider's API reports.
 */
export interface SenderIdentityRecord {
  readonly id: string;
  readonly displayName: string;
  readonly emailAddress: string;
  readonly domain: string;
  readonly providerId: string;
  readonly providerIdentityRef: string | null;

  readonly verificationStatus: SenderVerificationStatus;
  readonly dkimVerified: boolean;
  readonly spfReady: boolean;
  readonly dmarcReady: boolean;

  readonly replyToEmailAddress: string | null;
  readonly allowedRegions: ReadonlyArray<string>;
  readonly isActive: boolean;

  readonly failureReason: string | null;
  readonly verifiedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateSenderIdentityInput {
  readonly displayName: string;
  readonly emailAddress: string;
  readonly domain: string;
  readonly providerId: string;
  readonly replyToEmailAddress: string | null;
}
