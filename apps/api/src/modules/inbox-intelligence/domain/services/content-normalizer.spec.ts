import { normalizeProviderMessage } from './content-normalizer';
import { ProviderInboxMessageContent, ProviderInboxMessageMetadata } from '../models/provider-inbox-message';

function baseMetadata(overrides: Partial<ProviderInboxMessageMetadata> = {}): ProviderInboxMessageMetadata {
  return {
    providerMessageId: 'pmsg-1',
    providerThreadId: 'pthread-1',
    rfcMessageId: '<rfc-1@mail.example>',
    inReplyTo: '<sent-1@mail.example>',
    referencesHeaders: ['<sent-1@mail.example>'],
    fromAddress: 'hr@company.example',
    fromDisplayName: 'HR Team',
    toAddresses: ['candidate@example.com'],
    subject: 'Re: Your application',
    receivedAt: new Date('2026-08-01T10:00:00Z'),
    sizeEstimateBytes: 2000,
    isAutoReplyHeaderPresent: false,
    isDeliveryFailureHeaderPresent: false,
    ...overrides,
  };
}

function baseContent(overrides: Partial<ProviderInboxMessageContent> = {}, metadataOverrides: Partial<ProviderInboxMessageMetadata> = {}): ProviderInboxMessageContent {
  return {
    metadata: baseMetadata(metadataOverrides),
    plainTextBody: 'Thank you for your application.',
    htmlBody: null,
    hasCalendarInvite: false,
    attachmentMetadata: [],
    ...overrides,
  };
}

describe('normalizeProviderMessage', () => {
  it('passes every original provider identifier through untouched', () => {
    const result = normalizeProviderMessage(baseContent());
    expect(result.providerMessageId).toBe('pmsg-1');
    expect(result.providerThreadId).toBe('pthread-1');
    expect(result.rfcMessageId).toBe('<rfc-1@mail.example>');
    expect(result.inReplyTo).toBe('<sent-1@mail.example>');
    expect(result.referencesHeaders).toEqual(['<sent-1@mail.example>']);
  });

  it('prefers the HTML body over plain text when both are present, and strips markup', () => {
    const result = normalizeProviderMessage(
      baseContent({
        plainTextBody: 'PLAIN VERSION',
        htmlBody: '<p>Hello <b>there</b></p><br/><p>Second paragraph.</p>',
      }),
    );
    expect(result.candidateRelevantBody).not.toContain('PLAIN VERSION');
    expect(result.candidateRelevantBody).not.toContain('<');
    expect(result.candidateRelevantBody).toContain('Hello');
    expect(result.candidateRelevantBody).toContain('there');
    expect(result.candidateRelevantBody).toContain('Second paragraph.');
  });

  it('falls back to the plain-text body when no HTML body is present', () => {
    const result = normalizeProviderMessage(baseContent({ plainTextBody: 'Plain only body.', htmlBody: null }));
    expect(result.candidateRelevantBody).toBe('Plain only body.');
  });

  it('strips a quoted "On ... wrote:" prior message from the reply text', () => {
    const result = normalizeProviderMessage(
      baseContent({
        plainTextBody: 'Sounds good, thanks!\n\nOn Mon, Aug 1, 2026 at 9:00 AM John Doe wrote:\n> Original message text here\n> more quoted text',
      }),
    );
    expect(result.candidateRelevantBody).toBe('Sounds good, thanks!');
    expect(result.candidateRelevantBody).not.toContain('Original message text');
  });

  it('strips a quoted German "Am ... schrieb:" prior message from the reply text', () => {
    const result = normalizeProviderMessage(
      baseContent({
        plainTextBody: 'Klingt gut, danke!\n\nAm Montag, 1. August 2026 um 9:00 schrieb John Doe:\n> Ursprünglicher Text',
      }),
    );
    expect(result.candidateRelevantBody).toBe('Klingt gut, danke!');
  });

  it('strips a trailing signature block', () => {
    const result = normalizeProviderMessage(
      baseContent({
        plainTextBody: 'Thanks for reaching out.\n\nBest regards,\nJane Recruiter\nSenior Talent Acquisition',
      }),
    );
    expect(result.candidateRelevantBody).toBe('Thanks for reaching out.');
  });

  it('truncates an extremely long body to the 20,000-character bound', () => {
    const result = normalizeProviderMessage(baseContent({ plainTextBody: 'x'.repeat(30_000) }));
    expect(result.candidateRelevantBody.length).toBeLessThanOrEqual(20_000);
  });

  it('detects German language from German recruitment marker words', () => {
    const result = normalizeProviderMessage(baseContent({ plainTextBody: 'Sehr geehrte Damen und Herren, vielen Dank für Ihre Bewerbung.' }));
    expect(result.detectedLanguage).toBe('DE');
  });

  it('detects English language from English recruitment marker words', () => {
    const result = normalizeProviderMessage(baseContent({ plainTextBody: 'Dear Applicant, thank you for your interest in this application.' }));
    expect(result.detectedLanguage).toBe('EN');
  });

  it('detects UNKNOWN language when no marker words appear in subject or body', () => {
    const result = normalizeProviderMessage(baseContent({ plainTextBody: 'ok' }, { subject: 'Update' }));
    expect(result.detectedLanguage).toBe('UNKNOWN');
  });

  it('flags isOutOfOffice only when BOTH the auto-reply header is present AND out-of-office language appears in the text', () => {
    const withHeaderAndText = normalizeProviderMessage(
      baseContent({ plainTextBody: 'I am currently out of office and will respond when I am back.' }, { isAutoReplyHeaderPresent: true }),
    );
    expect(withHeaderAndText.isOutOfOffice).toBe(true);

    const withTextOnly = normalizeProviderMessage(
      baseContent({ plainTextBody: 'I am currently out of office and will respond when I am back.' }, { isAutoReplyHeaderPresent: false }),
    );
    expect(withTextOnly.isOutOfOffice).toBe(false);

    const withHeaderOnly = normalizeProviderMessage(baseContent({ plainTextBody: 'Thanks for your message.' }, { isAutoReplyHeaderPresent: true }));
    expect(withHeaderOnly.isOutOfOffice).toBe(false);
  });

  it('carries the auto-reply and delivery-failure header flags straight through', () => {
    const result = normalizeProviderMessage(baseContent({}, { isAutoReplyHeaderPresent: true, isDeliveryFailureHeaderPresent: true }));
    expect(result.isAutoReply).toBe(true);
    expect(result.isDeliveryFailure).toBe(true);
  });

  it('maps attachment metadata down to just the file names', () => {
    const result = normalizeProviderMessage(
      baseContent({
        attachmentMetadata: [
          { fileName: 'cv.pdf', mimeType: 'application/pdf', sizeBytes: 1000 },
          { fileName: 'contract.docx', mimeType: 'application/msword', sizeBytes: 2000 },
        ],
      }),
    );
    expect(result.attachmentFileNames).toEqual(['cv.pdf', 'contract.docx']);
  });

  it('takes only the first "to" address as toAddress, and empty string when none present', () => {
    const withAddress = normalizeProviderMessage(baseContent({}, { toAddresses: ['first@example.com', 'second@example.com'] }));
    expect(withAddress.toAddress).toBe('first@example.com');

    const withoutAddress = normalizeProviderMessage(baseContent({}, { toAddresses: [] }));
    expect(withoutAddress.toAddress).toBe('');
  });
});
