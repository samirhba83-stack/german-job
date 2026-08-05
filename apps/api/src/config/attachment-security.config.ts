import { registerAs } from '@nestjs/config';

/**
 * M28.5 — Attachment Security & Sender Identity config. `attachmentsProductionEnabled` and
 * `senderIdentityEnforcementEnabled` are independent kill switches from M28's
 * `emailInfrastructure.productionSendingEnabled` — real external delivery WITH attachments
 * requires all three to be satisfied (see `DomainReadinessService`/Production Safety Gates in
 * the M28.5 report), matching this codebase's established "fail closed, one flag per real
 * capability, never a single all-or-nothing switch" discipline.
 */
export default registerAs('attachmentSecurity', () => ({
  attachmentsProductionEnabled: (process.env.EMAIL_ATTACHMENTS_PRODUCTION_ENABLED ?? 'false').toLowerCase() === 'true',
  senderIdentityEnforcementEnabled: (process.env.EMAIL_SENDER_IDENTITY_ENFORCEMENT_ENABLED ?? 'false').toLowerCase() === 'true',

  storage: {
    provider: process.env.EMAIL_ATTACHMENT_STORAGE_PROVIDER ?? 'minio',
    endpoint: process.env.EMAIL_ATTACHMENT_STORAGE_ENDPOINT ?? 'http://localhost:9000',
    region: process.env.EMAIL_ATTACHMENT_STORAGE_REGION ?? 'us-east-1',
    bucket: process.env.EMAIL_ATTACHMENT_STORAGE_BUCKET ?? 'candidate-documents',
    accessKey: process.env.EMAIL_ATTACHMENT_STORAGE_ACCESS_KEY ?? '',
    secretKey: process.env.EMAIL_ATTACHMENT_STORAGE_SECRET_KEY ?? '',
  },

  policy: {
    maxFileSizeBytes: parseInt(process.env.EMAIL_ATTACHMENT_MAX_FILE_SIZE_BYTES ?? '10485760', 10),
    maxTotalSizeBytes: parseInt(process.env.EMAIL_ATTACHMENT_MAX_TOTAL_SIZE_BYTES ?? '20971520', 10),
    maxAttachmentCount: parseInt(process.env.EMAIL_ATTACHMENT_MAX_COUNT ?? '5', 10),
  },

  /** The one approved initial sender identity (M28.5 Phase 11 "Safe Sender Strategy") — a
   * verified platform domain, never an arbitrary user's own From address. Empty by default;
   * `DomainReadinessService` correctly reports `UNCONFIGURED` until an admin sets these AND
   * registers/verifies the identity with a real provider. */
  platformSender: {
    displayName: process.env.EMAIL_SENDER_PLATFORM_DISPLAY_NAME ?? 'German Job Engine',
    emailAddress: process.env.EMAIL_SENDER_PLATFORM_EMAIL_ADDRESS ?? '',
    domain: process.env.EMAIL_SENDER_PLATFORM_DOMAIN ?? '',
  },
}));
