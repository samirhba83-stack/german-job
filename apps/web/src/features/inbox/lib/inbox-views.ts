import type { InboxMessageDto } from '../types';

export type InboxViewKey = 'ALL' | 'NEEDS_ATTENTION' | 'INTERVIEWS' | 'DOCUMENTS' | 'POSITIVE' | 'REJECTIONS' | 'AUTOMATIC' | 'MANUAL_REVIEW';

/**
 * The 8 named views from the Inbox Workspace spec. The backend's `GET /inbox/messages` only takes
 * `reviewStatus`/`correlationStatus` query params — there is no server-side `primaryCategory`
 * filter — so these views reorder/filter the current real page already fetched, the same
 * "never invent a server signal that doesn't exist" discipline `CompanyList`'s client-side sort
 * follows. Each filter is a pure predicate over real `InboxMessageDto` fields only.
 */
export const INBOX_VIEWS: ReadonlyArray<{ key: InboxViewKey; label: string; filter: (message: InboxMessageDto) => boolean }> = [
  { key: 'ALL', label: 'All', filter: () => true },
  { key: 'NEEDS_ATTENTION', label: 'Needs attention', filter: (m) => m.reviewStatus === 'PENDING_REVIEW' },
  { key: 'INTERVIEWS', label: 'Interviews', filter: (m) => m.primaryCategory === 'INTERVIEW_INVITATION' || m.primaryCategory === 'ASSESSMENT_OR_TEST_INVITATION' },
  { key: 'DOCUMENTS', label: 'Documents', filter: (m) => m.primaryCategory === 'DOCUMENT_REQUEST' },
  { key: 'POSITIVE', label: 'Positive', filter: (m) => m.secondaryLabels.includes('POSITIVE') },
  { key: 'REJECTIONS', label: 'Rejections', filter: (m) => m.primaryCategory === 'REJECTION' },
  {
    key: 'AUTOMATIC',
    label: 'Automatic',
    filter: (m) => m.secondaryLabels.includes('AUTOMATED_REPLY') || m.primaryCategory === 'AUTOMATIC_REPLY' || m.primaryCategory === 'OUT_OF_OFFICE' || m.primaryCategory === 'DELIVERY_FAILURE',
  },
  {
    key: 'MANUAL_REVIEW',
    label: 'Manual review',
    filter: (m) => m.primaryCategory === 'NEEDS_MANUAL_REVIEW' || m.correlationStatus === 'AMBIGUOUS' || m.primaryCategory === null,
  },
];
