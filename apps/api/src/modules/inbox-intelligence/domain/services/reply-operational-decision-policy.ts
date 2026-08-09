import { ReplyPrimaryCategory } from '../models/reply-taxonomy';
import { ExtractedRecruitmentFacts } from '../models/extracted-facts';
import { FollowUpControlType } from '../../../recruitment-operations/domain/models/follow-up-control';
import { RecruitmentTaskType } from '../../../recruitment-operations/domain/models/recruitment-task';

export type FollowUpAction = 'CONTINUE' | 'PAUSE_TEMPORARY' | 'SUPPRESS_PERMANENT' | 'BLOCK_RECIPIENT';

/** M30 Phase 2 — which extracted-fact field (if any) supplies this category's task due-date. */
export type DeadlineSource = 'INTERVIEW_DATE' | 'SUBMISSION_DEADLINE' | 'ASSESSMENT_DEADLINE' | null;

export interface ReplyOperationalDecision {
  readonly followUpAction: FollowUpAction;
  readonly controlType: FollowUpControlType | null;
  /** Only meaningful when `followUpAction === 'PAUSE_TEMPORARY'` and no real deadline was
   * extracted — the confirmed default hold duration for that category (Phase 2/AUTONOMY
   * clarification). `null` means "no default — task-completion or manual release only." */
  readonly defaultHoldDurationDays: number | null;
  readonly taskType: RecruitmentTaskType | null;
  readonly deadlineSource: DeadlineSource;
  /** Whether this decision may take effect without a human confirming it first — deliberately
   * NEVER true for anything in `HIGH_IMPACT_CATEGORIES` (delegated to the existing
   * `ReplyDecisionPolicy`, never re-decided here — this field only governs the FOLLOW-UP/TASK side
   * effects, never the application-transition side, which stays exactly as `ReplyDecisionPolicy`
   * already decides it). */
  readonly autoApply: boolean;
}

const HOLD_NO_DATE: ReadonlyMap<ReplyPrimaryCategory, number> = new Map([
  // Phase 2 / AUTONOMY-confirmed default: 14 days when no explicit date is extracted.
  ['APPLICATION_UNDER_REVIEW', 14],
  ['WAITLIST_OR_DELAY', 14],
  // Confirmed default: a short 3-day grace period after a plain automated acknowledgment.
  ['APPLICATION_RECEIVED_CONFIRMATION', 3],
  // Not one of the 4 confirmed defaults — a shorter, independently-reasoned fallback for OOO
  // messages specifically (typically day/week-scale absences, not month-scale review cycles);
  // documented here, not asked about, since it's a narrower implementation detail than the 4
  // categories the AUTONOMY clause explicitly named.
  ['OUT_OF_OFFICE', 7],
]);

/**
 * M30 Phase 2 — the one authoritative reply-category -> operational-decision matrix. Pure,
 * deterministic, fully unit-testable — never itself queries a repository or calls a command.
 * `ReplyIngestionService` calls this once per classified message and acts on the result; the
 * APPLICATION-TRANSITION side of the decision (should a transition be proposed / does it need
 * confirmation) remains entirely owned by the existing `ReplyDecisionPolicy` — this policy only
 * ever decides the FOLLOW-UP SUPPRESSION and TASK-CREATION side effects, deliberately kept
 * separate so neither policy has to duplicate the other's confidence-banding logic.
 */
export function decideOperationalAction(category: ReplyPrimaryCategory, facts: ExtractedRecruitmentFacts): ReplyOperationalDecision {
  switch (category) {
    case 'INTERVIEW_INVITATION':
      return {
        followUpAction: 'SUPPRESS_PERMANENT',
        controlType: 'PERMANENT_SUPPRESSION',
        defaultHoldDurationDays: null,
        taskType: facts.interviewDate ? 'CONFIRM_INTERVIEW' : 'SELECT_INTERVIEW_SLOT',
        deadlineSource: 'INTERVIEW_DATE',
        autoApply: true,
      };
    case 'ACCEPTANCE_OR_OFFER':
      return {
        followUpAction: 'SUPPRESS_PERMANENT',
        controlType: 'PERMANENT_SUPPRESSION',
        defaultHoldDurationDays: null,
        taskType: 'REVIEW_OFFER',
        deadlineSource: null,
        autoApply: true,
      };
    case 'REJECTION':
      return {
        followUpAction: 'SUPPRESS_PERMANENT',
        controlType: 'PERMANENT_SUPPRESSION',
        defaultHoldDurationDays: null,
        taskType: null,
        deadlineSource: null,
        autoApply: true,
      };
    case 'WITHDRAWAL_CONFIRMATION':
      return {
        followUpAction: 'SUPPRESS_PERMANENT',
        controlType: 'PERMANENT_SUPPRESSION',
        defaultHoldDurationDays: null,
        taskType: null,
        deadlineSource: null,
        autoApply: true,
      };
    case 'DOCUMENT_REQUEST':
      return {
        followUpAction: 'PAUSE_TEMPORARY',
        controlType: 'TEMPORARY_HOLD',
        defaultHoldDurationDays: null, // task-completion or manual release only — no auto-expiry
        taskType: 'UPLOAD_REQUESTED_DOCUMENT',
        deadlineSource: 'SUBMISSION_DEADLINE',
        autoApply: true,
      };
    case 'INFORMATION_REQUEST':
    case 'AVAILABILITY_REQUEST':
      return {
        followUpAction: 'PAUSE_TEMPORARY',
        controlType: 'TEMPORARY_HOLD',
        defaultHoldDurationDays: null,
        taskType: 'PROVIDE_INFORMATION',
        deadlineSource: null,
        autoApply: true,
      };
    case 'ASSESSMENT_OR_TEST_INVITATION':
      return {
        followUpAction: 'PAUSE_TEMPORARY',
        controlType: 'TEMPORARY_HOLD',
        defaultHoldDurationDays: null,
        taskType: 'COMPLETE_ASSESSMENT',
        deadlineSource: 'ASSESSMENT_DEADLINE',
        autoApply: true,
      };
    case 'APPLICATION_UNDER_REVIEW':
    case 'WAITLIST_OR_DELAY':
      return {
        followUpAction: 'PAUSE_TEMPORARY',
        controlType: 'WAITING_PERIOD',
        defaultHoldDurationDays: HOLD_NO_DATE.get(category) ?? 14,
        taskType: null,
        deadlineSource: null,
        autoApply: true,
      };
    case 'APPLICATION_RECEIVED_CONFIRMATION':
      return {
        // Never permanently suppresses (Phase 2's own explicit instruction) — a short, confirmed
        // grace pause only.
        followUpAction: 'PAUSE_TEMPORARY',
        controlType: 'WAITING_PERIOD',
        defaultHoldDurationDays: HOLD_NO_DATE.get(category) ?? 3,
        taskType: null,
        deadlineSource: null,
        autoApply: true,
      };
    case 'OUT_OF_OFFICE':
      return {
        followUpAction: 'PAUSE_TEMPORARY',
        controlType: 'TEMPORARY_HOLD',
        defaultHoldDurationDays: HOLD_NO_DATE.get(category) ?? 7,
        taskType: null,
        deadlineSource: null,
        autoApply: true,
      };
    case 'DELIVERY_FAILURE':
      // Phase 2: "stop retries/follow-ups to the failed recipient... update delivery state only,
      // never employment outcome" — a recipient-scoped deliverability block, not an
      // application-outcome suppression; `ReplyDecisionPolicy` already auto-accepts this category
      // at HIGH confidence for the same reason.
      return {
        followUpAction: 'BLOCK_RECIPIENT',
        controlType: 'DELIVERABILITY_BLOCK',
        defaultHoldDurationDays: null,
        taskType: null,
        deadlineSource: null,
        autoApply: true,
      };
    case 'REFERRAL_TO_OTHER_POSITION':
    case 'AUTOMATIC_REPLY':
    case 'SPAM_OR_UNRELATED':
      // Phase 2: "do not permanently suppress follow-ups unless deterministic evidence justifies
      // it" — a generic auto-reply or referral is not, by itself, evidence the company wants no
      // further contact.
      return { followUpAction: 'CONTINUE', controlType: null, defaultHoldDurationDays: null, taskType: null, deadlineSource: null, autoApply: true };
    case 'NEEDS_MANUAL_REVIEW':
    case 'UNKNOWN':
    default:
      // Phase 2: "do not mutate external workflow state [i.e. never propose/execute an
      // application transition — ReplyDecisionPolicy already guarantees this at confidence 0]...
      // require manual review." A real, correlated reply whose content we could not classify is
      // safer held (pending a human look) than either silently continued (risking an
      // inappropriate follow-up right after a reply we don't understand) or silently suppressed
      // forever — MANUAL_REVIEW_HOLD is the dedicated, reversible, no-auto-expiry control for
      // exactly this case; a human's correction or explicit release is what lifts it, never a timer.
      return {
        followUpAction: 'PAUSE_TEMPORARY',
        controlType: 'MANUAL_REVIEW_HOLD',
        defaultHoldDurationDays: null,
        taskType: 'MANUAL_REPLY_REVIEW',
        deadlineSource: null,
        autoApply: true,
      };
  }
}
