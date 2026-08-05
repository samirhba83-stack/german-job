/**
 * The 15-state Application lifecycle. Deliberately named distinctly from the legacy
 * `ApplicationStatus` (6-value) enum rather than replacing it in place — superseding that
 * enum is a breaking change for its existing consumers and is tracked as a Phase 3 migration,
 * not silently absorbed here.
 */
export enum ApplicationLifecycleStatus {
  DRAFT = 'DRAFT',
  PREPARED = 'PREPARED',
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  OPENED = 'OPENED',
  VIEWED = 'VIEWED',
  COMPANY_REPLIED = 'COMPANY_REPLIED',
  INTERVIEW_SCHEDULED = 'INTERVIEW_SCHEDULED',
  INTERVIEW_COMPLETED = 'INTERVIEW_COMPLETED',
  OFFER_RECEIVED = 'OFFER_RECEIVED',
  CONTRACT_SIGNED = 'CONTRACT_SIGNED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
  ARCHIVED = 'ARCHIVED',
}
