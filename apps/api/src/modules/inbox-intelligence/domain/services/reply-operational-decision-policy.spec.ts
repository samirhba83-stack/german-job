import { decideOperationalAction } from './reply-operational-decision-policy';
import { emptyExtractedFacts, DateExtraction } from '../models/extracted-facts';
import { ReplyPrimaryCategory } from '../models/reply-taxonomy';

const dateFact = (overrides: Partial<DateExtraction> = {}): DateExtraction => ({ originalText: '15.03.2026', normalizedDate: '2026-03-15', isAmbiguous: false, ambiguityReason: null, ...overrides });

describe('decideOperationalAction', () => {
  it.each<ReplyPrimaryCategory>(['INTERVIEW_INVITATION', 'ACCEPTANCE_OR_OFFER', 'REJECTION', 'WITHDRAWAL_CONFIRMATION'])('permanently suppresses follow-ups for %s', (category) => {
    const result = decideOperationalAction(category, emptyExtractedFacts());
    expect(result.followUpAction).toBe('SUPPRESS_PERMANENT');
    expect(result.controlType).toBe('PERMANENT_SUPPRESSION');
    expect(result.defaultHoldDurationDays).toBeNull();
  });

  it('recommends confirming attendance when an interview date was extracted, else choosing a slot', () => {
    const withDate = decideOperationalAction('INTERVIEW_INVITATION', { ...emptyExtractedFacts(), interviewDate: dateFact() });
    expect(withDate.taskType).toBe('CONFIRM_INTERVIEW');
    const withoutDate = decideOperationalAction('INTERVIEW_INVITATION', emptyExtractedFacts());
    expect(withoutDate.taskType).toBe('SELECT_INTERVIEW_SLOT');
  });

  it('DOCUMENT_REQUEST pauses temporarily with no auto-expiry (task-completion or manual release only)', () => {
    const result = decideOperationalAction('DOCUMENT_REQUEST', emptyExtractedFacts());
    expect(result.followUpAction).toBe('PAUSE_TEMPORARY');
    expect(result.controlType).toBe('TEMPORARY_HOLD');
    expect(result.defaultHoldDurationDays).toBeNull();
    expect(result.taskType).toBe('UPLOAD_REQUESTED_DOCUMENT');
    expect(result.deadlineSource).toBe('SUBMISSION_DEADLINE');
  });

  it.each<ReplyPrimaryCategory>(['INFORMATION_REQUEST', 'AVAILABILITY_REQUEST'])('%s pauses temporarily with a PROVIDE_INFORMATION task and no auto-expiry', (category) => {
    const result = decideOperationalAction(category, emptyExtractedFacts());
    expect(result.followUpAction).toBe('PAUSE_TEMPORARY');
    expect(result.defaultHoldDurationDays).toBeNull();
    expect(result.taskType).toBe('PROVIDE_INFORMATION');
  });

  it('ASSESSMENT_OR_TEST_INVITATION pauses with a COMPLETE_ASSESSMENT task and an assessment deadline source', () => {
    const result = decideOperationalAction('ASSESSMENT_OR_TEST_INVITATION', emptyExtractedFacts());
    expect(result.taskType).toBe('COMPLETE_ASSESSMENT');
    expect(result.deadlineSource).toBe('ASSESSMENT_DEADLINE');
    expect(result.defaultHoldDurationDays).toBeNull();
  });

  it.each<ReplyPrimaryCategory>(['APPLICATION_UNDER_REVIEW', 'WAITLIST_OR_DELAY'])('%s pauses with the confirmed 14-day default hold when no date is extracted', (category) => {
    const result = decideOperationalAction(category, emptyExtractedFacts());
    expect(result.followUpAction).toBe('PAUSE_TEMPORARY');
    expect(result.controlType).toBe('WAITING_PERIOD');
    expect(result.defaultHoldDurationDays).toBe(14);
    expect(result.taskType).toBeNull();
  });

  it('APPLICATION_RECEIVED_CONFIRMATION never permanently suppresses — only the confirmed 3-day grace pause', () => {
    const result = decideOperationalAction('APPLICATION_RECEIVED_CONFIRMATION', emptyExtractedFacts());
    expect(result.followUpAction).toBe('PAUSE_TEMPORARY');
    expect(result.controlType).toBe('WAITING_PERIOD');
    expect(result.defaultHoldDurationDays).toBe(3);
  });

  it('OUT_OF_OFFICE pauses temporarily with a 7-day fallback, never permanently stops the campaign', () => {
    const result = decideOperationalAction('OUT_OF_OFFICE', emptyExtractedFacts());
    expect(result.followUpAction).toBe('PAUSE_TEMPORARY');
    expect(result.defaultHoldDurationDays).toBe(7);
  });

  it('DELIVERY_FAILURE blocks only the recipient — never an employment-outcome signal', () => {
    const result = decideOperationalAction('DELIVERY_FAILURE', emptyExtractedFacts());
    expect(result.followUpAction).toBe('BLOCK_RECIPIENT');
    expect(result.controlType).toBe('DELIVERABILITY_BLOCK');
  });

  it.each<ReplyPrimaryCategory>(['REFERRAL_TO_OTHER_POSITION', 'AUTOMATIC_REPLY', 'SPAM_OR_UNRELATED'])('%s never suppresses follow-ups without deterministic evidence', (category) => {
    const result = decideOperationalAction(category, emptyExtractedFacts());
    expect(result.followUpAction).toBe('CONTINUE');
    expect(result.controlType).toBeNull();
  });

  it.each<ReplyPrimaryCategory>(['NEEDS_MANUAL_REVIEW', 'UNKNOWN'])('%s pauses (never mutates application state) and creates a manual-review task with no auto-expiry', (category) => {
    const result = decideOperationalAction(category, emptyExtractedFacts());
    expect(result.followUpAction).toBe('PAUSE_TEMPORARY');
    expect(result.controlType).toBe('MANUAL_REVIEW_HOLD');
    expect(result.taskType).toBe('MANUAL_REPLY_REVIEW');
    expect(result.defaultHoldDurationDays).toBeNull();
  });

  it('every decision is marked autoApply — never itself requires confirmation (that stays ReplyDecisionPolicy\'s job for the transition side)', () => {
    const categories: ReplyPrimaryCategory[] = [
      'INTERVIEW_INVITATION', 'ACCEPTANCE_OR_OFFER', 'REJECTION', 'DOCUMENT_REQUEST', 'INFORMATION_REQUEST', 'ASSESSMENT_OR_TEST_INVITATION',
      'APPLICATION_UNDER_REVIEW', 'WAITLIST_OR_DELAY', 'APPLICATION_RECEIVED_CONFIRMATION', 'OUT_OF_OFFICE', 'DELIVERY_FAILURE',
      'REFERRAL_TO_OTHER_POSITION', 'AUTOMATIC_REPLY', 'SPAM_OR_UNRELATED', 'NEEDS_MANUAL_REVIEW', 'UNKNOWN', 'WITHDRAWAL_CONFIRMATION', 'ACCEPTANCE_OR_OFFER',
    ];
    for (const category of categories) {
      expect(decideOperationalAction(category, emptyExtractedFacts()).autoApply).toBe(true);
    }
  });
});
