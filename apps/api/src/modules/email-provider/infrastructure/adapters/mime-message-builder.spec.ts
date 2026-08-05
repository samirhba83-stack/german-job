import { buildRawMimeEmail } from './mime-message-builder';

const BASE = {
  fromDisplayName: 'German Job Engine',
  fromEmailAddress: 'applications@example.com',
  toEmailAddress: 'hr@company.example',
  replyToEmailAddress: 'candidate@example.com',
  subject: 'Application for Backend Engineer',
  plainTextBody: 'Please find my application attached.',
  htmlBody: null as string | null,
  attachments: [] as { fileName: string; mimeType: string; content: Buffer }[],
};

describe('buildRawMimeEmail', () => {
  it('produces a well-formed multipart/mixed message with real headers', () => {
    const message = buildRawMimeEmail(BASE).toString('utf8');

    expect(message).toContain('From: German Job Engine <applications@example.com>');
    expect(message).toContain('To: hr@company.example');
    expect(message).toContain('Reply-To: candidate@example.com');
    expect(message).toContain('Subject: Application for Backend Engineer');
    expect(message).toContain('MIME-Version: 1.0');
    expect(message).toMatch(/Content-Type: multipart\/mixed; boundary="[^"]+"/);
  });

  it('omits the Reply-To header entirely when none is supplied', () => {
    const message = buildRawMimeEmail({ ...BASE, replyToEmailAddress: null }).toString('utf8');
    expect(message).not.toContain('Reply-To:');
  });

  it('base64-encodes the plain-text body', () => {
    const message = buildRawMimeEmail(BASE).toString('utf8');
    const encoded = Buffer.from(BASE.plainTextBody, 'utf8').toString('base64');
    expect(message).toContain(encoded);
    expect(message).not.toContain(BASE.plainTextBody);
  });

  it('builds a multipart/alternative section when both plain-text and HTML bodies are present', () => {
    const message = buildRawMimeEmail({ ...BASE, htmlBody: '<p>Please find my application attached.</p>' }).toString('utf8');
    expect(message).toMatch(/Content-Type: multipart\/alternative; boundary="[^"]+"/);
    expect(message).toContain('Content-Type: text/plain; charset="UTF-8"');
    expect(message).toContain('Content-Type: text/html; charset="UTF-8"');
  });

  it('sanitizes CRLF sequences in the subject, preventing header injection', () => {
    const malicious = 'Hello\r\nBcc: attacker@evil.example\r\nSubject: Second Header';
    const message = buildRawMimeEmail({ ...BASE, subject: malicious }).toString('utf8');
    const lines = message.split('\r\n');

    // The real security property: the injected text must never become its own header LINE — it
    // is folded into the single, harmless Subject value instead (CR/LF replaced with spaces).
    expect(lines).not.toContain('Bcc: attacker@evil.example');
    expect(lines.filter((line) => line.startsWith('Subject:'))).toHaveLength(1);
    const subjectLine = lines.find((line) => line.startsWith('Subject:'));
    expect(subjectLine).toBeDefined();
    expect(subjectLine).not.toMatch(/[\r\n]/);
  });

  it('sanitizes CRLF sequences in an attachment filename', () => {
    const message = buildRawMimeEmail({
      ...BASE,
      attachments: [{ fileName: 'cv.pdf\r\nX-Injected: true', mimeType: 'application/pdf', content: Buffer.from('%PDF-1.4 fake') }],
    }).toString('utf8');
    const lines = message.split('\r\n');

    // Again, the real property: no standalone injected header line — the attacker's text is
    // folded into the (harmless) filename value instead.
    expect(lines).not.toContain('X-Injected: true');
  });

  it('includes a correctly base64-encoded attachment part with the right MIME type and disposition', () => {
    const attachmentContent = Buffer.from('%PDF-1.4 real pdf bytes here');
    const message = buildRawMimeEmail({ ...BASE, attachments: [{ fileName: 'cv.pdf', mimeType: 'application/pdf', content: attachmentContent }] }).toString('utf8');

    expect(message).toContain('Content-Type: application/pdf; name="cv.pdf"');
    expect(message).toContain('Content-Disposition: attachment; filename="cv.pdf"');
    expect(message).toContain('Content-Transfer-Encoding: base64');
    expect(message).toContain(attachmentContent.toString('base64'));
  });

  it('includes multiple attachments, each as its own MIME part', () => {
    const message = buildRawMimeEmail({
      ...BASE,
      attachments: [
        { fileName: 'cv.pdf', mimeType: 'application/pdf', content: Buffer.from('cv content') },
        { fileName: 'letter.pdf', mimeType: 'application/pdf', content: Buffer.from('letter content') },
      ],
    }).toString('utf8');

    expect(message).toContain('filename="cv.pdf"');
    expect(message).toContain('filename="letter.pdf"');
  });

  it('wraps base64 attachment content at 76 characters per line (RFC 2045)', () => {
    const largeContent = Buffer.alloc(300, 'a');
    const message = buildRawMimeEmail({ ...BASE, attachments: [{ fileName: 'big.pdf', mimeType: 'application/pdf', content: largeContent }] }).toString('utf8');
    const lines = message.split('\r\n').filter((line) => /^[A-Za-z0-9+/=]{10,}$/.test(line));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(76);
    }
  });

  it('terminates the message with the closing mixed boundary', () => {
    const message = buildRawMimeEmail(BASE).toString('utf8');
    const boundaryMatch = message.match(/boundary="([^"]+)"/);
    expect(boundaryMatch).not.toBeNull();
    expect(message).toContain(`--${boundaryMatch![1]}--`);
  });
});
