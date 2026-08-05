import { recommendNextAction } from './next-action-engine';
import { emptyExtractedFacts, DateExtraction } from '../models/extracted-facts';

const dateFact = (text: string): DateExtraction => ({ originalText: text, normalizedDate: null, isAmbiguous: true, ambiguityReason: null });

describe('recommendNextAction', () => {
  it('recommends confirming attendance when an interview date was extracted', () => {
    const result = recommendNextAction('INTERVIEW_INVITATION', { ...emptyExtractedFacts(), interviewDate: dateFact('15.03.2026') });
    expect(result.type).toBe('CONFIRM_INTERVIEW_ATTENDANCE');
    expect(result.description).toContain('15.03.2026');
    expect(result.basedOnEvidence).toContain('15.03.2026');
  });

  it('recommends choosing a slot when an interview was detected but no date was extracted', () => {
    const result = recommendNextAction('INTERVIEW_INVITATION', emptyExtractedFacts());
    expect(result.type).toBe('CHOOSE_INTERVIEW_SLOT');
  });

  it('lists the specific requested documents when present', () => {
    const result = recommendNextAction('DOCUMENT_REQUEST', { ...emptyExtractedFacts(), requestedDocuments: ['CV', 'reference letter'] });
    expect(result.type).toBe('UPLOAD_REQUESTED_DOCUMENT');
    expect(result.description).toContain('CV');
    expect(result.description).toContain('reference letter');
  });

  it('falls back to a generic document prompt when no specific documents were extracted', () => {
    const result = recommendNextAction('DOCUMENT_REQUEST', emptyExtractedFacts());
    expect(result.type).toBe('UPLOAD_REQUESTED_DOCUMENT');
    expect(result.description).not.toContain('undefined');
  });

  it('maps AVAILABILITY_REQUEST and INFORMATION_REQUEST to the same reply-with-info action', () => {
    expect(recommendNextAction('AVAILABILITY_REQUEST', emptyExtractedFacts()).type).toBe('REPLY_WITH_MISSING_INFORMATION');
    expect(recommendNextAction('INFORMATION_REQUEST', emptyExtractedFacts()).type).toBe('REPLY_WITH_MISSING_INFORMATION');
  });

  it('includes the assessment deadline when present', () => {
    const result = recommendNextAction('ASSESSMENT_OR_TEST_INVITATION', { ...emptyExtractedFacts(), assessmentDeadline: dateFact('20.03.2026') });
    expect(result.type).toBe('PREPARE_FOR_ASSESSMENT');
    expect(result.description).toContain('20.03.2026');
  });

  it('recommends reviewing rejection feedback for REJECTION', () => {
    expect(recommendNextAction('REJECTION', emptyExtractedFacts()).type).toBe('REVIEW_REJECTION_FEEDBACK');
  });

  it('recommends waiting for WAITLIST_OR_DELAY, APPLICATION_UNDER_REVIEW, and APPLICATION_RECEIVED_CONFIRMATION', () => {
    expect(recommendNextAction('WAITLIST_OR_DELAY', emptyExtractedFacts()).type).toBe('WAIT_UNTIL_STATED_DATE');
    expect(recommendNextAction('APPLICATION_UNDER_REVIEW', emptyExtractedFacts()).type).toBe('WAIT_UNTIL_STATED_DATE');
    expect(recommendNextAction('APPLICATION_RECEIVED_CONFIRMATION', emptyExtractedFacts()).type).toBe('WAIT_UNTIL_STATED_DATE');
  });

  it('recommends reviewing an offer for ACCEPTANCE_OR_OFFER, never auto-confirming', () => {
    const result = recommendNextAction('ACCEPTANCE_OR_OFFER', emptyExtractedFacts());
    expect(result.type).toBe('REPLY_WITH_MISSING_INFORMATION');
    expect(result.description.toLowerCase()).not.toContain('accepted');
  });

  it('recommends marking as unrelated for SPAM_OR_UNRELATED', () => {
    expect(recommendNextAction('SPAM_OR_UNRELATED', emptyExtractedFacts()).type).toBe('MARK_AS_UNRELATED');
  });

  it('falls back to human review for NEEDS_MANUAL_REVIEW, UNKNOWN, and any other unmapped category', () => {
    expect(recommendNextAction('NEEDS_MANUAL_REVIEW', emptyExtractedFacts()).type).toBe('ASK_FOR_HUMAN_REVIEW');
    expect(recommendNextAction('UNKNOWN', emptyExtractedFacts()).type).toBe('ASK_FOR_HUMAN_REVIEW');
    expect(recommendNextAction('OUT_OF_OFFICE', emptyExtractedFacts()).type).toBe('ASK_FOR_HUMAN_REVIEW');
  });

  it('every recommendation description reads as an imperative recommendation, not a completed action', () => {
    const completedActionWords = ['confirmed', 'sent', 'replied', 'uploaded', 'done'];
    const categories: Array<Parameters<typeof recommendNextAction>[0]> = [
      'INTERVIEW_INVITATION',
      'DOCUMENT_REQUEST',
      'AVAILABILITY_REQUEST',
      'ASSESSMENT_OR_TEST_INVITATION',
      'REJECTION',
      'ACCEPTANCE_OR_OFFER',
      'SPAM_OR_UNRELATED',
      'NEEDS_MANUAL_REVIEW',
    ];
    for (const category of categories) {
      const description = recommendNextAction(category, emptyExtractedFacts()).description.toLowerCase();
      for (const word of completedActionWords) {
        expect(description).not.toContain(word);
      }
    }
  });
});
