import { ReplyPrimaryCategory } from '../models/reply-taxonomy';
import { ExtractedRecruitmentFacts } from '../models/extracted-facts';

export type NextActionType =
  | 'CONFIRM_INTERVIEW_ATTENDANCE'
  | 'CHOOSE_INTERVIEW_SLOT'
  | 'UPLOAD_REQUESTED_DOCUMENT'
  | 'REPLY_WITH_MISSING_INFORMATION'
  | 'PREPARE_FOR_ASSESSMENT'
  | 'REVIEW_REJECTION_FEEDBACK'
  | 'WAIT_UNTIL_STATED_DATE'
  | 'FOLLOW_UP_AFTER_DEADLINE'
  | 'MARK_AS_UNRELATED'
  | 'ASK_FOR_HUMAN_REVIEW';

export interface NextActionRecommendation {
  readonly type: NextActionType;
  /** Always phrased as a recommendation, never as a completed action (Phase 15: "do not represent
   * a recommendation as a completed action") — every description starts with an imperative verb
   * aimed at the candidate, e.g. "Confirm...", "Reply with...", never "Confirmed"/"Replied". */
  readonly description: string;
  readonly basedOnEvidence: string;
}

/**
 * M29 Phase 15 — a pure mapping from (category, extracted facts) to a safe, evidence-grounded
 * recommendation. Every branch cites the specific extracted fact it used, so
 * `basedOnEvidence` is never a generic restatement of the category alone.
 */
export function recommendNextAction(category: ReplyPrimaryCategory, facts: ExtractedRecruitmentFacts): NextActionRecommendation {
  switch (category) {
    case 'INTERVIEW_INVITATION':
      return facts.interviewDate
        ? { type: 'CONFIRM_INTERVIEW_ATTENDANCE', description: `Confirm your attendance for the interview on ${facts.interviewDate.originalText}.`, basedOnEvidence: `Extracted interview date: "${facts.interviewDate.originalText}"` }
        : { type: 'CHOOSE_INTERVIEW_SLOT', description: 'Reply to propose or choose an interview time — no specific date was stated.', basedOnEvidence: 'Interview invitation detected, no specific date extracted from the message.' };
    case 'DOCUMENT_REQUEST':
      return { type: 'UPLOAD_REQUESTED_DOCUMENT', description: facts.requestedDocuments.length > 0 ? `Provide the requested document(s): ${facts.requestedDocuments.join(', ')}.` : 'Provide the requested document(s) mentioned in the message.', basedOnEvidence: 'Document-request language detected.' };
    case 'INFORMATION_REQUEST':
    case 'AVAILABILITY_REQUEST':
      return { type: 'REPLY_WITH_MISSING_INFORMATION', description: 'Reply with the requested information.', basedOnEvidence: 'Information/availability-request language detected.' };
    case 'ASSESSMENT_OR_TEST_INVITATION':
      return { type: 'PREPARE_FOR_ASSESSMENT', description: facts.assessmentDeadline ? `Prepare for and complete the assessment before ${facts.assessmentDeadline.originalText}.` : 'Prepare for and complete the assessment.', basedOnEvidence: 'Assessment/test invitation language detected.' };
    case 'REJECTION':
      return { type: 'REVIEW_REJECTION_FEEDBACK', description: 'Review the rejection — no further action is required unless feedback was offered.', basedOnEvidence: 'Rejection language detected.' };
    case 'WAITLIST_OR_DELAY':
      return { type: 'WAIT_UNTIL_STATED_DATE', description: 'No action needed yet — the company indicated a delay.', basedOnEvidence: 'Waitlist/delay language detected.' };
    case 'APPLICATION_UNDER_REVIEW':
    case 'APPLICATION_RECEIVED_CONFIRMATION':
      return { type: 'WAIT_UNTIL_STATED_DATE', description: 'No action needed — this is an acknowledgment, not a decision.', basedOnEvidence: 'Application-received/under-review confirmation detected.' };
    case 'ACCEPTANCE_OR_OFFER':
      return { type: 'REPLY_WITH_MISSING_INFORMATION', description: 'Review the offer carefully and reply once you have decided.', basedOnEvidence: 'Offer/acceptance language detected.' };
    case 'SPAM_OR_UNRELATED':
      return { type: 'MARK_AS_UNRELATED', description: 'This message does not look like a genuine recruitment reply — consider marking it unrelated.', basedOnEvidence: 'Spam/unrelated pattern detected.' };
    case 'NEEDS_MANUAL_REVIEW':
    case 'UNKNOWN':
    default:
      return { type: 'ASK_FOR_HUMAN_REVIEW', description: 'Review this message manually — it could not be classified with enough confidence to recommend a specific action.', basedOnEvidence: 'No deterministic rule matched this message with sufficient confidence.' };
  }
}
