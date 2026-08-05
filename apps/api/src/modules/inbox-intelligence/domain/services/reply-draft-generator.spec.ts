import { generateReplyDraft, ReplyDraftGenerationInput } from './reply-draft-generator';
import { emptyExtractedFacts, DateExtraction } from '../models/extracted-facts';
import { ReplyDraftType } from '../models/reply-draft';

const dateFact = (text: string): DateExtraction => ({ originalText: text, normalizedDate: null, isAmbiguous: true, ambiguityReason: null });

function baseInput(overrides: Partial<ReplyDraftGenerationInput> = {}): ReplyDraftGenerationInput {
  return {
    draftType: 'POLITE_FOLLOWUP',
    candidateName: 'Alex Müller',
    companyName: 'Acme GmbH',
    jobTitle: 'Backend Engineer',
    originalSubject: 'Your application',
    language: 'EN',
    facts: emptyExtractedFacts(),
    ...overrides,
  };
}

describe('generateReplyDraft', () => {
  it('prefixes the subject with "Re: " in English when not already present', () => {
    const result = generateReplyDraft(baseInput({ originalSubject: 'Your application', language: 'EN' }));
    expect(result.subject).toBe('Re: Your application');
  });

  it('prefixes the subject with "AW: " in German when not already present', () => {
    const result = generateReplyDraft(baseInput({ originalSubject: 'Ihre Bewerbung', language: 'DE' }));
    expect(result.subject).toBe('AW: Ihre Bewerbung');
  });

  it('does not double-prefix a subject that already carries the reply prefix', () => {
    const result = generateReplyDraft(baseInput({ originalSubject: 'Re: Your application', language: 'EN' }));
    expect(result.subject).toBe('Re: Your application');
  });

  it('fills the interview date placeholder from a real extracted fact for INTERVIEW_ACCEPTANCE', () => {
    const result = generateReplyDraft(baseInput({ draftType: 'INTERVIEW_ACCEPTANCE', facts: { ...emptyExtractedFacts(), interviewDate: dateFact('Tuesday, 10am') } }));
    expect(result.bodyText).toContain('Tuesday, 10am');
    expect(result.placeholders).toEqual([]);
  });

  it('leaves an explicit bracketed placeholder marker when the interview date fact is missing', () => {
    const result = generateReplyDraft(baseInput({ draftType: 'INTERVIEW_ACCEPTANCE', facts: emptyExtractedFacts() }));
    expect(result.bodyText).toContain('[Confirm interview date/time]');
    expect(result.placeholders).toHaveLength(1);
    expect(result.placeholders[0]).toEqual({ label: 'Confirm interview date/time', filled: false });
  });

  it('never invents a value — REQUEST_ALTERNATIVE_TIME always leaves the alternative-time placeholder unfilled', () => {
    const result = generateReplyDraft(baseInput({ draftType: 'REQUEST_ALTERNATIVE_TIME' }));
    expect(result.placeholders).toHaveLength(1);
    expect(result.placeholders[0].filled).toBe(false);
    expect(result.bodyText).toContain('[Propose an alternative time]');
  });

  it('lists real requested documents for DOCUMENT_SUBMISSION_ACKNOWLEDGMENT without a placeholder', () => {
    const result = generateReplyDraft(baseInput({ draftType: 'DOCUMENT_SUBMISSION_ACKNOWLEDGMENT', facts: { ...emptyExtractedFacts(), requestedDocuments: ['CV', 'transcript'] } }));
    expect(result.bodyText).toContain('CV, transcript');
    expect(result.placeholders).toEqual([]);
  });

  it('falls back to a placeholder for DOCUMENT_SUBMISSION_ACKNOWLEDGMENT when no documents were extracted', () => {
    const result = generateReplyDraft(baseInput({ draftType: 'DOCUMENT_SUBMISSION_ACKNOWLEDGMENT', facts: emptyExtractedFacts() }));
    expect(result.placeholders).toHaveLength(1);
  });

  it.each<ReplyDraftType>(['INTERVIEW_ACCEPTANCE', 'REQUEST_ALTERNATIVE_TIME', 'DOCUMENT_SUBMISSION_ACKNOWLEDGMENT', 'INFORMATION_RESPONSE', 'POLITE_FOLLOWUP', 'OFFER_ACKNOWLEDGMENT', 'REJECTION_ACKNOWLEDGMENT'])(
    'produces a non-empty body containing the candidate name and job title for draft type %s',
    (draftType) => {
      const result = generateReplyDraft(baseInput({ draftType }));
      expect(result.bodyText.length).toBeGreaterThan(0);
      expect(result.bodyText).toContain('Alex Müller');
      expect(result.bodyText).toContain('Backend Engineer');
    },
  );

  it('produces the correct German closing for a German draft and English closing for an English draft', () => {
    const german = generateReplyDraft(baseInput({ language: 'DE' }));
    const english = generateReplyDraft(baseInput({ language: 'EN' }));
    expect(german.bodyText).toContain('Mit freundlichen Grüßen,');
    expect(english.bodyText).toContain('Kind regards,');
  });

  it('never includes an "[undefined]" or "null" artifact in generated text', () => {
    const result = generateReplyDraft(baseInput({ draftType: 'INTERVIEW_ACCEPTANCE', facts: emptyExtractedFacts() }));
    expect(result.bodyText).not.toContain('undefined');
    expect(result.bodyText).not.toContain('null');
  });
});
