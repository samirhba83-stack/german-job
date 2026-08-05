/** M29 Phase 9 — the one approved recruitment reply taxonomy. Every value is justified by a real,
 * distinct downstream behavior (a different rule/next-action/notification) — never added "just in
 * case," matching this codebase's own `ConnectedMailboxStatus` precedent for state justification. */
export type ReplyPrimaryCategory =
  | 'INTERVIEW_INVITATION'
  | 'ACCEPTANCE_OR_OFFER'
  | 'REJECTION'
  | 'DOCUMENT_REQUEST'
  | 'INFORMATION_REQUEST'
  | 'AVAILABILITY_REQUEST'
  | 'ASSESSMENT_OR_TEST_INVITATION'
  | 'APPLICATION_RECEIVED_CONFIRMATION'
  | 'APPLICATION_UNDER_REVIEW'
  | 'WAITLIST_OR_DELAY'
  | 'REFERRAL_TO_OTHER_POSITION'
  | 'WITHDRAWAL_CONFIRMATION'
  | 'AUTOMATIC_REPLY'
  | 'OUT_OF_OFFICE'
  | 'DELIVERY_FAILURE'
  | 'SPAM_OR_UNRELATED'
  | 'NEEDS_MANUAL_REVIEW'
  | 'UNKNOWN';

/** Secondary labels compose freely with a primary category — deliberately not collapsed into a
 * single enum value (Phase 9: "do not collapse nuanced messages into only accepted/rejected"). A
 * REJECTION can simultaneously carry DEADLINE_PRESENT (a reapplication window) or ACTION_REQUIRED
 * (a requested exit survey), etc. */
export type ReplySecondaryLabel =
  | 'POSITIVE'
  | 'NEGATIVE'
  | 'NEUTRAL'
  | 'ACTION_REQUIRED'
  | 'DEADLINE_PRESENT'
  | 'INTERVIEW_DATE_PRESENT'
  | 'DOCUMENTS_REQUIRED'
  | 'HUMAN_REPLY'
  | 'AUTOMATED_REPLY';

export type ClassificationSource = 'RULE_ENGINE' | 'AI' | 'USER_CORRECTED';

/** Irreversible or high-impact categories — Phase 12's own explicit list. `ReplyDecisionPolicy`
 * requires explicit user confirmation before any of these are allowed to actually change an
 * application's real lifecycle status, regardless of confidence. */
export const HIGH_IMPACT_CATEGORIES: ReadonlySet<ReplyPrimaryCategory> = new Set<ReplyPrimaryCategory>([
  'ACCEPTANCE_OR_OFFER',
  'REJECTION',
  'WITHDRAWAL_CONFIRMATION',
]);
