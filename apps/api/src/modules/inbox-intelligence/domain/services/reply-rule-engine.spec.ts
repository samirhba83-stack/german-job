import { classifyByRules } from './reply-rule-engine';
import { NormalizedInboxMessage } from '../models/normalized-message';

function baseMessage(overrides: Partial<NormalizedInboxMessage> = {}): NormalizedInboxMessage {
  return {
    providerMessageId: 'msg-1',
    providerThreadId: 'thread-1',
    rfcMessageId: '<abc@mail.example>',
    inReplyTo: null,
    referencesHeaders: [],
    fromAddress: 'hr@company.example',
    toAddress: 'candidate@example.com',
    subject: 'Re: Your application',
    receivedAt: new Date('2026-08-01T10:00:00Z'),
    candidateRelevantBody: '',
    detectedLanguage: 'EN',
    isAutoReply: false,
    isDeliveryFailure: false,
    isOutOfOffice: false,
    hasCalendarInvite: false,
    attachmentFileNames: [],
    ...overrides,
  };
}

describe('classifyByRules', () => {
  describe('provider-header-driven terminal cases (checked before any text rule)', () => {
    it('classifies DELIVERY_FAILURE from the provider header flag at 0.98 confidence, ignoring body text', () => {
      const result = classifyByRules(baseMessage({ isDeliveryFailure: true, candidateRelevantBody: 'We are pleased to offer you the position.' }));
      expect(result.category).toBe('DELIVERY_FAILURE');
      expect(result.confidence).toBe(0.98);
      expect(result.matchedRuleIds).toEqual(['RULE_DELIVERY_FAILURE_HEADER']);
      expect(result.rulesWereSufficient).toBe(true);
    });

    it('classifies AUTOMATIC_REPLY when the auto-reply header is set and it is not an out-of-office', () => {
      const result = classifyByRules(baseMessage({ isAutoReply: true, isOutOfOffice: false }));
      expect(result.category).toBe('AUTOMATIC_REPLY');
      expect(result.confidence).toBe(0.9);
      expect(result.matchedRuleIds).toEqual(['RULE_AUTO_REPLY_HEADER']);
    });

    it('classifies OUT_OF_OFFICE (not AUTOMATIC_REPLY) when both the auto-reply and out-of-office flags are set', () => {
      const result = classifyByRules(baseMessage({ isAutoReply: true, isOutOfOffice: true }));
      expect(result.category).toBe('OUT_OF_OFFICE');
      expect(result.confidence).toBe(0.9);
      expect(result.matchedRuleIds).toEqual(['RULE_OUT_OF_OFFICE_HEADER']);
    });

    it('delivery-failure header takes priority over the out-of-office header', () => {
      const result = classifyByRules(baseMessage({ isDeliveryFailure: true, isOutOfOffice: true }));
      expect(result.category).toBe('DELIVERY_FAILURE');
    });
  });

  describe('text-pattern rules, English', () => {
    it('classifies REJECTION from typical rejection phrasing', () => {
      const result = classifyByRules(baseMessage({ candidateRelevantBody: 'Unfortunately, we have decided to move forward with another candidate for this role.' }));
      expect(result.category).toBe('REJECTION');
      expect(result.confidence).toBe(0.8);
      expect(result.matchedRuleIds).toEqual(['RULE_REJECTION_EN']);
      expect(result.rulesWereSufficient).toBe(true);
    });

    it('classifies INTERVIEW_INVITATION from an interview-scheduling phrase', () => {
      const result = classifyByRules(baseMessage({ candidateRelevantBody: 'We would like to invite you to an interview next week.' }));
      expect(result.category).toBe('INTERVIEW_INVITATION');
      expect(result.matchedRuleIds).toEqual(['RULE_INTERVIEW_EN']);
      expect(result.secondaryLabels).toEqual(expect.arrayContaining(['POSITIVE', 'ACTION_REQUIRED', 'INTERVIEW_DATE_PRESENT', 'HUMAN_REPLY']));
    });

    it('classifies INTERVIEW_INVITATION from a calendar invite alone, with no matching text', () => {
      const result = classifyByRules(baseMessage({ candidateRelevantBody: 'See attached.', hasCalendarInvite: true }));
      expect(result.category).toBe('INTERVIEW_INVITATION');
      expect(result.confidence).toBe(0.75);
      expect(result.matchedRuleIds).toEqual(['RULE_CALENDAR_INVITE']);
    });

    it('classifies ACCEPTANCE_OR_OFFER from offer phrasing', () => {
      const result = classifyByRules(baseMessage({ candidateRelevantBody: 'We are pleased to offer you the position of Backend Engineer.' }));
      expect(result.category).toBe('ACCEPTANCE_OR_OFFER');
      expect(result.matchedRuleIds).toEqual(['RULE_OFFER_EN']);
    });

    it('classifies DOCUMENT_REQUEST from a document-request phrase', () => {
      const result = classifyByRules(baseMessage({ candidateRelevantBody: 'Could you please send us your latest references?' }));
      expect(result.category).toBe('DOCUMENT_REQUEST');
      expect(result.matchedRuleIds).toEqual(['RULE_DOCUMENT_REQUEST_EN']);
    });

    it('classifies AVAILABILITY_REQUEST from an availability phrase', () => {
      const result = classifyByRules(baseMessage({ candidateRelevantBody: 'When would you be available for a short call this week?' }));
      expect(result.category).toBe('AVAILABILITY_REQUEST');
      expect(result.matchedRuleIds).toEqual(['RULE_AVAILABILITY_REQUEST']);
    });

    it('classifies ASSESSMENT_OR_TEST_INVITATION from an assessment phrase', () => {
      const result = classifyByRules(baseMessage({ candidateRelevantBody: 'As a next step, please complete this online test / coding challenge.' }));
      expect(result.category).toBe('ASSESSMENT_OR_TEST_INVITATION');
      expect(result.matchedRuleIds).toEqual(['RULE_ASSESSMENT']);
    });

    it('classifies WITHDRAWAL_CONFIRMATION from a withdrawal-confirmation phrase', () => {
      const result = classifyByRules(baseMessage({ candidateRelevantBody: 'We are confirming your withdrawal from the recruitment process.' }));
      expect(result.category).toBe('WITHDRAWAL_CONFIRMATION');
      expect(result.matchedRuleIds).toEqual(['RULE_WITHDRAWAL']);
    });

    it('classifies REFERRAL_TO_OTHER_POSITION from a referral phrase', () => {
      const result = classifyByRules(baseMessage({ candidateRelevantBody: 'We think a different role might be a better fit for you.' }));
      expect(result.category).toBe('REFERRAL_TO_OTHER_POSITION');
      expect(result.matchedRuleIds).toEqual(['RULE_REFERRAL']);
    });

    it('classifies WAITLIST_OR_DELAY from a delay phrase', () => {
      const result = classifyByRules(baseMessage({ candidateRelevantBody: 'The decision will take a bit longer than expected, please bear with us.' }));
      expect(result.category).toBe('WAITLIST_OR_DELAY');
      expect(result.matchedRuleIds).toEqual(['RULE_WAITLIST']);
    });

    it('classifies APPLICATION_UNDER_REVIEW from a review-status phrase', () => {
      const result = classifyByRules(baseMessage({ candidateRelevantBody: 'Your application is currently under review by our team.' }));
      expect(result.category).toBe('APPLICATION_UNDER_REVIEW');
      expect(result.matchedRuleIds).toEqual(['RULE_UNDER_REVIEW']);
    });

    it('classifies APPLICATION_RECEIVED_CONFIRMATION from a receipt-confirmation phrase', () => {
      const result = classifyByRules(baseMessage({ candidateRelevantBody: 'We have received your application and will be in touch soon.' }));
      expect(result.category).toBe('APPLICATION_RECEIVED_CONFIRMATION');
      expect(result.matchedRuleIds).toEqual(['RULE_APPLICATION_RECEIVED']);
    });

    it('classifies SPAM_OR_UNRELATED from an obvious marketing/spam phrase', () => {
      const result = classifyByRules(baseMessage({ candidateRelevantBody: 'Congratulations, you have won! Click here to claim your limited time offer.' }));
      expect(result.category).toBe('SPAM_OR_UNRELATED');
      expect(result.matchedRuleIds).toEqual(['RULE_SPAM_MARKER']);
    });
  });

  describe('text-pattern rules, German', () => {
    it('classifies REJECTION from typical German rejection phrasing', () => {
      const result = classifyByRules(baseMessage({ candidateRelevantBody: 'Wir haben uns leider für einen anderen Kandidaten entschieden.' }));
      expect(result.category).toBe('REJECTION');
      expect(result.matchedRuleIds).toEqual(['RULE_REJECTION_DE']);
    });

    it('classifies INTERVIEW_INVITATION from German interview phrasing', () => {
      const result = classifyByRules(baseMessage({ candidateRelevantBody: 'Wir möchten Sie herzlich zu einem Vorstellungsgespräch einladen.' }));
      expect(result.category).toBe('INTERVIEW_INVITATION');
      expect(result.matchedRuleIds).toEqual(['RULE_INTERVIEW_DE']);
    });

    it('classifies DOCUMENT_REQUEST from German document-request phrasing', () => {
      const result = classifyByRules(baseMessage({ candidateRelevantBody: 'Bitte senden Sie uns Ihre vollständigen Arbeitszeugnisse zu.' }));
      expect(result.category).toBe('DOCUMENT_REQUEST');
      expect(result.matchedRuleIds).toEqual(['RULE_DOCUMENT_REQUEST_DE']);
    });
  });

  describe('rule priority ordering', () => {
    it('picks the earlier-listed rule when a message matches two distinct rule patterns', () => {
      // Matches both RULE_DOCUMENT_REQUEST_EN ("could you please send") and RULE_AVAILABILITY_REQUEST
      // ("when are you available") — document-request is listed first in RULES, so it must win.
      const result = classifyByRules(baseMessage({ candidateRelevantBody: 'Could you please send your availability? When are you available next week?' }));
      expect(result.category).toBe('DOCUMENT_REQUEST');
      expect(result.matchedRuleIds).toEqual(['RULE_DOCUMENT_REQUEST_EN']);
    });
  });

  describe('no rule match', () => {
    it('returns NEEDS_MANUAL_REVIEW (never UNKNOWN) with zero confidence when nothing matches', () => {
      const result = classifyByRules(baseMessage({ candidateRelevantBody: 'Thanks for the update, talk soon.' }));
      expect(result.category).toBe('NEEDS_MANUAL_REVIEW');
      expect(result.confidence).toBe(0);
      expect(result.evidence).toEqual([]);
      expect(result.matchedRuleIds).toEqual([]);
      expect(result.rulesWereSufficient).toBe(false);
    });
  });

  describe('extracted facts', () => {
    it('extracts a contact email, phone number, and video meeting link from the body', () => {
      const result = classifyByRules(
        baseMessage({
          candidateRelevantBody: 'Please reach out to recruiting@company.example or call +49 30 1234567. Join us at https://meet.google.com/abc-defg-hij.',
        }),
      );
      expect(result.extractedFacts.contactEmail).toBe('recruiting@company.example');
      expect(result.extractedFacts.contactPhone).toContain('30');
      expect(result.extractedFacts.videoMeetingLink).toContain('meet.google.com');
    });

    it('normalizes an unambiguous DD.MM.YYYY deadline date', () => {
      const result = classifyByRules(baseMessage({ candidateRelevantBody: 'Please submit the requested documents by 15.03.2026.' }));
      expect(result.extractedFacts.submissionDeadline).not.toBeNull();
      expect(result.extractedFacts.submissionDeadline?.isAmbiguous).toBe(false);
      expect(result.extractedFacts.submissionDeadline?.normalizedDate).toBe('2026-03-15');
    });

    it('leaves facts empty (all null/empty) when nothing is present in the body', () => {
      const result = classifyByRules(baseMessage({ candidateRelevantBody: 'Thanks for the update.' }));
      expect(result.extractedFacts.contactEmail).toBeNull();
      expect(result.extractedFacts.contactPhone).toBeNull();
      expect(result.extractedFacts.videoMeetingLink).toBeNull();
      expect(result.extractedFacts.submissionDeadline).toBeNull();
    });
  });
});
